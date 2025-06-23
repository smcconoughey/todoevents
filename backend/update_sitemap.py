import asyncio
import logging
import sys

# Ensure project root is on path when executed from Render shell
from pathlib import Path
root = Path(__file__).resolve().parent.parent
sys.path.append(str(root))

from backend import backend as be  # noqa: E402

logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(message)s')

async def main():
    logging.info('🔄 Manually triggering sitemap generation ...')
    await be.task_manager.generate_sitemap_automatically()
    logging.info('✅ Sitemap regenerated and cached in memory')

if __name__ == '__main__':
    asyncio.run(main()) 