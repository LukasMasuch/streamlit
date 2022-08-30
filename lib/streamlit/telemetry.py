import contextlib
import enum
import inspect
from collections.abc import Sized
from functools import wraps
from timeit import default_timer as timer
from typing import Any, Callable, List, Optional, TypeVar, cast

from streamlit.logger import get_logger
from streamlit.proto.PageProfile_pb2 import Argument, Command
from streamlit.runtime.scriptrunner import get_script_run_ctx

LOGGER = get_logger(__name__)

# Limit the number of commands to keep the page profile message small
# Segment allows a maximum of 32kb per event.
MAX_TRACKED_COMMANDS = 150
NAME_MAPPING = {
    "streamlit.delta_generator.DeltaGenerator": "DG",
    "pandas.core.frame.DataFrame": "DataFrame",
    "plotly.graph_objs._figure.Figure": "PlotlyFigure",
    "bokeh.plotting.figure.Figure": "BokehFigure",
    "matplotlib.figure.Figure": "MatplotlibFigure",
    "MemoAPI": "experimental_memo",
    "SingletonAPI": "experimental_singleton",
    "pandas.io.formats.style.Styler": "PandasStyler",
    "pandas.core.indexes.base.Index": "PandasIndex",
    "_transparent_write": "magic",
}


def _to_microseconds(seconds):
    return int(seconds * 1000000)


def _get_type_name(obj: object) -> str:
    with contextlib.suppress(Exception):
        obj_type = type(obj)
        if obj_type.__module__ == "builtins":
            type_name = obj_type.__qualname__
        else:
            type_name = f"{obj_type.__module__}.{obj_type.__qualname__}"

        if type_name in NAME_MAPPING:
            type_name = NAME_MAPPING[type_name]
        return type_name
    return "failed"


def _get_callable_name(callable: Callable) -> str:
    with contextlib.suppress(Exception):
        name = "unknown"
        if inspect.isclass(callable):
            name = callable.__class__.__name__
        elif hasattr(callable, "__qualname__"):
            name = callable.__qualname__
        elif hasattr(callable, "__name__"):
            name = callable.__name__

        if name.endswith("__call__"):
            # Only return the class name
            return name.rsplit(".", 1)[0]
        elif "." in name:
            # Only return actual function name
            return name.split(".")[-1]
        return name
    return "failed"


def _get_arg_metadata(arg: object) -> Optional[str]:
    with contextlib.suppress(Exception):
        if isinstance(arg, bool):
            return f"val:{arg}"

        if isinstance(arg, int):
            return f"val:{arg}"

        if isinstance(arg, enum.Enum):
            return f"val:{arg}"

        if isinstance(arg, Sized):
            return f"len:{len(arg)}"

    return None


def _get_command_telemetry(callable: Callable, *args, **kwargs) -> Command:
    arg_keywords = inspect.getfullargspec(callable).args
    self_arg: Optional[Any] = None
    arguments: List[Argument] = []

    # Add positional arguments
    for i, arg in enumerate(args):
        keyword = arg_keywords[i] if len(arg_keywords) > i else f"{i}"
        if keyword == "self":
            self_arg = arg
            # Do not add self arguments
            continue
        arguments.append(
            Argument(
                k=keyword,
                t=_get_type_name(arg),
                m=_get_arg_metadata(arg),
                p=i,
            )
        )

    # Add keyword arguments
    arguments.extend(
        [
            Argument(
                k=kwarg,
                t=_get_type_name(kwargs[kwarg]),
                m=_get_arg_metadata(kwargs[kwarg]),
            )
            for kwarg in kwargs
        ]
    )

    name = _get_callable_name(callable)
    if (
        name == "create_instance"
        and self_arg
        and hasattr(self_arg, "name")
        and self_arg.name
    ):
        # Use custom component name
        name = f"component:{self_arg.name}"
    if name in NAME_MAPPING:
        name = NAME_MAPPING[name]
    return Command(name=name, args=arguments)


F = TypeVar("F", bound=Callable[..., Any])


def track_telemetry(callable: F) -> F:
    @wraps(callable)
    def wrap(*args, **kwargs):
        ctx = get_script_run_ctx()

        tracking_activated = (
            ctx is not None
            and ctx.gather_usage_stats
            and not ctx._tracking_deactivated
            and len(ctx._tracked_commands)
            < MAX_TRACKED_COMMANDS  # Prevent too much memory usage
        )

        # Deactivate tracking to prevent calls inside already tracked commands
        if ctx:
            ctx._tracking_deactivated = True

        exec_start = timer()
        result = callable(*args, **kwargs)

        # Activate tracking again
        if ctx:
            ctx._tracking_deactivated = False

        if not tracking_activated:
            return result

        try:
            command_telemetry = _get_command_telemetry(callable, *args, **kwargs)
            command_telemetry.time = _to_microseconds(timer() - exec_start)
            ctx._tracked_commands.append(command_telemetry)

        except Exception as ex:
            # Always capture all exceptions since we want to make sure that
            # the telemetry never causes any issues.
            LOGGER.debug("Failed to collect command telemetry", exc_info=ex)
        return result

    # Make this a well-behaved decorator by preserving important function
    # attributes.
    try:
        wrap.__dict__.update(callable.__dict__)
    except AttributeError:
        pass

    return cast(F, wrap)
