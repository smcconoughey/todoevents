#!/usr/bin/env python3

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

print("\nTesting when backend is imported...")
try:
    import backend
    print('Backend missionops_router:', backend.missionops_router)
    print('Backend app routes with missionops:')
    missionops_routes = [route for route in backend.app.routes if 'missionops' in route.path.lower()]
    print('Found', len(missionops_routes), 'missionops routes')
except Exception as e:
    print('❌ Backend import error:', str(e))
    import traceback
    traceback.print_exc() 