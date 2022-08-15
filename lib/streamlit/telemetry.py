from asyncio.log import logger
import contextlib
import enum
import inspect
import sys
import builtins
import importlib
from collections.abc import Sized
from functools import wraps
from timeit import default_timer as timer
from typing import Callable, List, Optional, Tuple

from streamlit.logger import get_logger
from streamlit.proto.AppProfile_pb2 import Argument, Fingerprint

LOGGER = get_logger(__name__)

# Generated from: https://docs.python.org/3.10/py-modindex.html
_TOP_LEVEL_BUILTIN_MODULES = [
    "__future__",
    "__main__",
    "_thread",
    "abc",
    "aifc",
    "argparse",
    "array",
    "ast",
    "asynchat",
    "asyncio",
    "asyncore",
    "atexit",
    "audioop",
    "base64",
    "bdb",
    "binascii",
    "binhex",
    "bisect",
    "builtins",
    "bz2",
    "cProfile",
    "calendar",
    "cgi",
    "cgitb",
    "chunk",
    "cmath",
    "cmd",
    "code",
    "codecs",
    "codeop",
    "collections",
    "colorsys",
    "compileall",
    "concurrent",
    "configparser",
    "contextlib",
    "contextvars",
    "copy",
    "copyreg",
    "crypt",
    "csv",
    "ctypes",
    "curses",
    "dataclasses",
    "datetime",
    "dbm",
    "decimal",
    "difflib",
    "dis",
    "distutils",
    "doctest",
    "email",
    "encodings",
    "ensurepip",
    "enum",
    "errno",
    "faulthandler",
    "fcntl",
    "filecmp",
    "fileinput",
    "fnmatch",
    "fractions",
    "ftplib",
    "functools",
    "gc",
    "getopt",
    "getpass",
    "gettext",
    "glob",
    "graphlib",
    "grp",
    "gzip",
    "hashlib",
    "heapq",
    "hmac",
    "html",
    "http",
    "idlelib",
    "imaplib",
    "imghdr",
    "imp",
    "importlib",
    "inspect",
    "io",
    "ipaddress",
    "itertools",
    "json",
    "keyword",
    "lib2to3",
    "linecache",
    "locale",
    "logging",
    "lzma",
    "mailbox",
    "mailcap",
    "marshal",
    "math",
    "mimetypes",
    "mmap",
    "modulefinder",
    "msilib",
    "msvcrt",
    "multiprocessing",
    "netrc",
    "nis",
    "nntplib",
    "numbers",
    "operator",
    "optparse",
    "os",
    "ossaudiodev",
    "pathlib",
    "pdb",
    "pickle",
    "pickletools",
    "pipes",
    "pkgutil",
    "platform",
    "plistlib",
    "poplib",
    "posix",
    "pprint",
    "profile",
    "pstats",
    "pty",
    "pwd",
    "py_compile",
    "pyclbr",
    "pydoc",
    "queue",
    "quopri",
    "random",
    "re",
    "readline",
    "reprlib",
    "resource",
    "rlcompleter",
    "runpy",
    "sched",
    "secrets",
    "select",
    "selectors",
    "shelve",
    "shlex",
    "shutil",
    "signal",
    "site",
    "smtpd",
    "smtplib",
    "sndhdr",
    "socket",
    "socketserver",
    "spwd",
    "sqlite3",
    "ssl",
    "stat",
    "statistics",
    "string",
    "stringprep",
    "struct",
    "subprocess",
    "sunau",
    "symtable",
    "sys",
    "sysconfig",
    "syslog",
    "tabnanny",
    "tarfile",
    "telnetlib",
    "tempfile",
    "termios",
    "test",
    "textwrap",
    "threading",
    "time",
    "timeit",
    "tkinter",
    "token",
    "tokenize",
    "trace",
    "traceback",
    "tracemalloc",
    "tty",
    "turtle",
    "turtledemo",
    "types",
    "typing",
    "unicodedata",
    "unittest",
    "urllib",
    "uu",
    "uuid",
    "venv",
    "warnings",
    "wave",
    "weakref",
    "webbrowser",
    "winreg",
    "winsound",
    "wsgiref",
    "xdrlib",
    "xml",
    "xmlrpc",
    "zipapp",
    "zipfile",
    "zipimport",
    "zlib",
    "zoneinfo",
]

_IGNORED_MODULES = set(
    [
        "streamlit",
        "tornado",
        "numpy",
        "pandas",
        "dateutil",
        "google",
        "protobuf",
        "pyarrow",
        "altair",
        "requests",
        "rich",
    ]
    + _TOP_LEVEL_BUILTIN_MODULES
)

_TYPE_MAPPING = {
    "streamlit.delta_generator.DeltaGenerator": "DG",
    "pandas.core.frame.DataFrame": "DataFrame",
}


def _get_top_level_module(full_module_name):
    return full_module_name.split(".")[0]


class CaptureImportedModules:
    """
    A context manager to capture imported modules by temporarily applying a patch to
    `builtins.__import__` and `importlib.import_module`.
    """

    def __init__(self):
        self.imported_modules = set()
        self.original_import = None
        self.original_import_module = None

    def _wrap_import(self, original):
        @wraps(original)
        def wrapper(name, globals=None, locals=None, fromlist=(), level=0):
            is_absolute_import = level == 0
            if not name.startswith("_") and is_absolute_import:
                top_level_module = _get_top_level_module(name)
                if top_level_module not in _IGNORED_MODULES:
                    self.imported_modules.add(top_level_module)
            return original(name, globals, locals, fromlist, level)

        return wrapper

    def _wrap_import_module(self, original):
        @wraps(original)
        def wrapper(name, *args, **kwargs):
            if not name.startswith("_"):
                top_level_module = _get_top_level_module(name)
                if top_level_module not in _IGNORED_MODULES:
                    self.imported_modules.add(top_level_module)
            return original(name, *args, **kwargs)

        return wrapper

    def __enter__(self):
        # Patch `builtins.__import__` and `importlib.import_module`
        self.original_import = builtins.__import__
        self.original_import_module = importlib.import_module
        builtins.__import__ = self._wrap_import(self.original_import)
        importlib.import_module = self._wrap_import_module(self.original_import_module)
        return self

    def __exit__(self, *_, **__):
        # Revert the patches
        builtins.__import__ = self.original_import
        importlib.import_module = self.original_import_module


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


def get_arg_metadata(arg: object) -> Tuple[Optional[str], Optional[str]]:
    if isinstance(arg, bool):
        with contextlib.suppress(Exception):
            return "value", str(arg)

    if isinstance(arg, enum.Enum):
        with contextlib.suppress(Exception):
            return "value", str(arg)

    if isinstance(arg, Sized):
        with contextlib.suppress(Exception):
            return "length", str(len(arg))

    return None, None


def track_fingerprint(callable: Callable) -> Callable:
    from streamlit.runtime.scriptrunner import get_script_run_ctx

    @wraps(callable)
    def wrap(*args, **kwargs):
        exec_start = timer()
        result = callable(*args, **kwargs)

        # Suppress all exceptions, since we want to make sure that the telemetry
        # never causes any issues.
        try:
            fingerprint_exec_start = timer()
            ctx = get_script_run_ctx()

            # Todo: ignore self
            arg_keywords = inspect.getfullargspec(callable).args
            self_arg_type: Optional[str] = None
            arguments: List[Argument] = []
            for i, arg in enumerate(args):
                keyword = arg_keywords[i] if len(arg_keywords) > i else f"{i}"
                if keyword == "self":
                    self_arg_type = get_type_name(arg)
                    # Do not add self arguments
                    continue
                arguments.append(
                    Argument(
                        keyword=keyword,
                        type=get_type_name(arg),
                        metadata_type=get_arg_metadata(arg)[0],
                        metadata=get_arg_metadata(arg)[1],
                        position=i,
                    )
                )

            arguments.extend(
                [
                    Argument(
                        keyword=kwarg,
                        type=get_type_name(kwargs[kwarg]),
                        metadata_type=get_arg_metadata(kwargs[kwarg])[0],
                        metadata=get_arg_metadata(kwargs[kwarg])[1],
                    )
                    for kwarg in kwargs
                ]
            )

            modulenames = set(sys.modules) & set(globals())
            allmodules = [sys.modules[name] for name in modulenames]
            debug_str = str(allmodules)

            name = get_callable_name(callable)
            if name == "CustomComponent.create_instance" and self_arg_type:
                name = self_arg_type.rsplit(".", 1)[-1]

            ctx.add_fingerprint(
                Fingerprint(
                    name=name,
                    arguments=arguments,
                    return_type=get_type_name(result),
                    exec_time=float(timer() - exec_start),
                    debug_stuff=debug_str,
                    fingerprint_exec_time=float(timer() - fingerprint_exec_start),
                )
            )
        except Exception as ex:
            LOGGER.debug("Failed to collect fingerprints", exc_info=ex)
            pass
        return result

    return wrap
