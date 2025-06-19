try:
    from missionops_endpoints import missionops_router
    print('✅ Import successful')
    print('Router:', missionops_router)
    print('Type:', type(missionops_router))
    print('Prefix:', missionops_router.prefix)
    print('Routes:', len(missionops_router.routes))
except Exception as e:
    print('❌ Import error:', str(e))
    import traceback
    traceback.print_exc() 