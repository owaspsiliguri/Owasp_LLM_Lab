"""Runs inside the sandbox subprocess. Reads learner code from stdin, executes the module's tests."""
import importlib
import json
import sys

sys.path.insert(0, ".")


def main() -> None:
    module_id = sys.argv[1]
    spec = importlib.import_module(f"app.fixit.{module_id}")
    code = sys.stdin.read()
    namespace: dict = {}
    try:
        exec(compile(code, "<submission>", "exec"), namespace)  # noqa: S102  # nosec B102 - AST-checked, rlimited subprocess
        fn = namespace.get(spec.FUNC_NAME)
        if not callable(fn):
            raise NameError(f"Define a function named {spec.FUNC_NAME}")
        tests = spec.run_tests(fn)
    except Exception as exc:  # learner code may raise anything
        print(json.dumps({"passed": False, "error": f"{type(exc).__name__}: {exc}", "tests": []}))
        return
    print(json.dumps({"passed": all(t["passed"] for t in tests), "error": None, "tests": tests}))


main()
