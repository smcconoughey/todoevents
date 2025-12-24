import asyncio
import logging
import sys

# Ensure project root is on path when executed from Render shell
from pathlib import Path
root = Path(__file__).resolve().parent.parent
sys.path.append(str(root))

# 1. Dynamically load backend/backend.py so we can call its task manager.
from importlib.util import spec_from_file_location, module_from_spec  # noqa: E402

# Construct a module spec from the exact file location and execute it **before**
# any code tries to access the "be" module reference.
backend_file = (root / "backend" / "backend.py").resolve()

spec = spec_from_file_location("backend_module", backend_file)
be = module_from_spec(spec)
spec.loader.exec_module(be)

# 2. Configure logging and run the sitemap generation helper.
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(message)s')

async def main():
    logging.info("🔄 Manually triggering sitemap generation ...")
    await be.task_manager.generate_sitemap_automatically()
    logging.info("✅ Sitemap regenerated and cached in memory")

if __name__ == "__main__":
    asyncio.run(main()) 