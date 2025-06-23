import asyncio
import logging
import sys
import importlib  # noqa: E402

# Ensure project root is on path when executed from Render shell
from pathlib import Path
root = Path(__file__).resolve().parent.parent
sys.path.append(str(root))

# Load backend/backend.py as a proper module object named "be"
be = importlib.import_module("backend.backend")

logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(message)s')

async def main():
    logging.info('🔄 Manually triggering sitemap generation ...')
    await be.task_manager.generate_sitemap_automatically()
    logging.info('✅ Sitemap regenerated and cached in memory')

if __name__ == '__main__':
    asyncio.run(main()) 