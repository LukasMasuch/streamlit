import contextlib
import enum
import inspect
from collections.abc import Sized
from functools import wraps
from timeit import default_timer as timer
from typing import Any, Callable, List, Optional

from streamlit.logger import get_logger
from streamlit.proto.PageProfile_pb2 import Argument, Fingerprint

LOGGER = get_logger(__name__)

MAX_FINGERPRINTS = 250

_TYPE_MAPPING = {
    "streamlit.delta_generator.DeltaGenerator": "DG",
    "pandas.core.frame.DataFrame": "DataFrame",
}


def _to_microseconds(seconds):
    return int(seconds * 1000000)


def get_type_name(obj: object) -> str:
    with contextlib.suppress(Exception):
        obj_type = type(obj)
        if obj_type.__module__ == "builtins":
            type_name = obj_type.__qualname__
        else:
            type_name = f"{obj_type.__module__}.{obj_type.__qualname__}"

        if type_name in _TYPE_MAPPING:
            type_name = _TYPE_MAPPING[type_name]
        return type_name
    return "failed"


def get_callable_name(callable: Callable) -> str:
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


def get_arg_metadata(arg: object) -> Optional[str]:
    with contextlib.suppress(Exception):
        if isinstance(arg, bool):
            return f"value:{arg}"

        if isinstance(arg, int):
            return f"value:{arg}"

        if isinstance(arg, enum.Enum):
            return f"value:{arg}"

        if isinstance(arg, Sized):
            return f"length:{len(arg)}"

    return None


def track_fingerprint(callable: Callable) -> Callable:
    @wraps(callable)
    def wrap(*args, **kwargs):
        exec_start = timer()
        result = callable(*args, **kwargs)

        try:
            fingerprint_exec_start = timer()
            # Import here to avoid circular dependency
            from streamlit.runtime.scriptrunner import get_script_run_ctx

            ctx = get_script_run_ctx()
            if not ctx.track_fingerprints or len(ctx._fingerprints) > MAX_FINGERPRINTS:
                # Only track the first X fingerprints to prevent too much memory usage
                return result

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
                        keyword=keyword,
                        type=get_type_name(arg),
                        metadata=get_arg_metadata(arg),
                        position=i,
                    )
                )

            # Add keyword arguments
            arguments.extend(
                [
                    Argument(
                        keyword=kwarg,
                        type=get_type_name(kwargs[kwarg]),
                        metadata=get_arg_metadata(kwargs[kwarg]),
                    )
                    for kwarg in kwargs
                ]
            )

            name = get_callable_name(callable)
            if (
                name == "create_instance"
                and self_arg
                and hasattr(self_arg, "name")
                and self_arg.name
            ):
                # Get custom component name
                name = str(self_arg.name)

            ctx.add_fingerprint(
                Fingerprint(
                    name=name,
                    args=arguments,
                    exec_time=_to_microseconds(timer() - exec_start),
                    fingerprint_exec_time=_to_microseconds(
                        timer() - fingerprint_exec_start
                    ),
                )
            )
        except Exception as ex:
            # Always capture all exceptions since we want to make sure that
            # the telemetry never causes any issues.
            LOGGER.debug("Failed to collect fingerprints", exc_info=ex)
        return result

    return wrap
