import contextlib
import enum
import sys
import inspect
from collections.abc import Sized
from functools import wraps
from timeit import default_timer as timer
from typing import Any, Callable, List, Optional, TypeVar, cast, Final, Set

from streamlit import config
from streamlit.logger import get_logger
from streamlit.proto.PageProfile_pb2 import Argument, Command
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.scriptrunner import get_script_run_ctx

LOGGER = get_logger(__name__)

# Limit the number of commands to keep the page profile message small
# Segment allows a maximum of 32kb per event.
MAX_TRACKED_COMMANDS: Final = 150
NAME_MAPPING: Final = {
    # Object mappings
    "streamlit.delta_generator.DeltaGenerator": "DG",
    "pandas.core.frame.DataFrame": "DataFrame",
    "plotly.graph_objs._figure.Figure": "PlotlyFigure",
    "bokeh.plotting.figure.Figure": "BokehFigure",
    "matplotlib.figure.Figure": "MatplotlibFigure",
    "pandas.io.formats.style.Styler": "PandasStyler",
    "pandas.core.indexes.base.Index": "PandasIndex",
    # Function mappings
    "_transparent_write": "magic",
    "MemoAPI.__call__": "experimental_memo",
    "SingletonAPI.__call__": "experimental_singleton",
    "SingletonCache.write_result": "_cache_singleton_object",
    "MemoCache.write_result": "_cache_memo_object",
    "_write_to_cache": "_cache_object",
}
ATTRIBUTIONS_TO_CHECK: Final = ["snowflake"]


def to_microseconds(seconds):
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
        if name in NAME_MAPPING:
            name = NAME_MAPPING[name]
        elif "." in name:
            # Only return actual function name
            name = name.split(".")[-1]
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
        argument = Argument(
            k=keyword,
            t=_get_type_name(arg),
            p=i,
        )
        if arg_metadata := _get_arg_metadata(arg):
            argument.m = arg_metadata

        arguments.append(argument)

    # Add keyword arguments
    for kwarg in kwargs:
        kwarg_value = kwargs[kwarg]
        argument = Argument(
            k=kwarg,
            t=_get_type_name(kwarg_value),
        )
        if arg_metadata := _get_arg_metadata(kwarg_value):
            argument.m = arg_metadata
        arguments.append(argument)

    name = _get_callable_name(callable)
    if (
        name == "create_instance"
        and self_arg
        and hasattr(self_arg, "name")
        and self_arg.name
    ):
        # Use custom component name
        name = f"component:{self_arg.name}"
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
            command_telemetry.time = to_microseconds(timer() - exec_start)
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


def create_page_profile_message(
    commands: List[Command],
    exec_time: int,
    prep_time: int,
    uncaught_exception: Optional[str] = None,
) -> ForwardMsg:
    """Create and return an PageProfile ForwardMsg."""

    msg = ForwardMsg()
    msg.page_profile.commands.extend(commands)
    msg.page_profile.exec_time = exec_time
    msg.page_profile.prep_time = prep_time

    config_options: Set[str] = set()
    if config._config_options:
        for option_name in config._config_options.keys():
            if not config.is_manually_set(option_name):
                # We only care about manually defined options
                continue

            config_option = config._config_options[option_name]
            if config_option.is_default:
                option_name = f"{option_name}:default"
            config_options.add(option_name)

    msg.page_profile.config.extend(config_options)

    attributions: Set[str] = {
        attribution
        for attribution in ATTRIBUTIONS_TO_CHECK
        if attribution in sys.modules
    }

    msg.page_profile.attributions.extend(attributions)

    if uncaught_exception:
        msg.page_profile.uncaught_exception = uncaught_exception

    return msg
