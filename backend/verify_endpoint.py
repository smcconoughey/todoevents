@app.post("/debug/verify-premium-events-simple")
async def verify_premium_events_simple():
    """Simple debug endpoint to verify premium events without authentication"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Find all events created by premium users that aren't verified
            cursor.execute("""
                UPDATE events 
                SET verified = TRUE 
                WHERE created_by IN (
                    SELECT id FROM users WHERE role IN ('premium', 'admin')
                ) AND (verified = FALSE OR verified IS NULL)
            """)
            
            affected_rows = cursor.rowcount
            conn.commit()
            
            return {
                "success": True,
                "verified_events": affected_rows,
                "message": f"Verified {affected_rows} events from premium users"
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Error verifying premium events"
        } 