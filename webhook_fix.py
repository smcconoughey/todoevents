#!/usr/bin/env python3

# Read the backend file
with open('backend/backend.py', 'r') as f:
    content = f.read()

# Find the webhook function and replace it with a clean version
webhook_start = content.find('@app.post("/stripe/webhook")')
webhook_end = content.find('async def handle_successful_payment(session):')

if webhook_start != -1 and webhook_end != -1:
    # Clean webhook function
    clean_webhook = '''@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    # FORCE IMMEDIATE LOGGING WITH MULTIPLE METHODS
    import sys
    import os
    
    # Method 1: Logger
    logger.info("🔔🔔🔔 WEBHOOK ENDPOINT HIT! 🔔🔔🔔")
    logger.warning("🔔🔔🔔 WEBHOOK ENDPOINT HIT! 🔔🔔🔔")
    logger.error("🔔🔔🔔 WEBHOOK ENDPOINT HIT! 🔔🔔🔔")
    
    # Method 2: Print to stdout
    print("🔔🔔🔔 WEBHOOK ENDPOINT HIT! 🔔🔔🔔")
    
    # Method 3: Print to stderr  
    print("🔔🔔🔔 WEBHOOK ENDPOINT HIT! 🔔🔔🔔", file=sys.stderr)
    
    # Method 4: Force flush
    sys.stdout.flush()
    sys.stderr.flush()
    
    # Method 5: Write to a file for debugging
    try:
        with open("/tmp/webhook_debug.log", "a") as f:
            f.write(f"WEBHOOK HIT: {datetime.utcnow().isoformat()}\\n")
            f.flush()
    except:
        pass
    
    try:
        payload = await request.body()
        sig_header = request.headers.get('stripe-signature')
        
        logger.info(f"🔔 Webhook payload size: {len(payload)}, signature present: {bool(sig_header)}")
        print(f"🔔 Webhook payload size: {len(payload)}, signature present: {bool(sig_header)}")
        
        if not STRIPE_WEBHOOK_SECRET:
            logger.error("❌ STRIPE_WEBHOOK_SECRET not configured")
            print("❌ STRIPE_WEBHOOK_SECRET not configured")
            raise HTTPException(status_code=500, detail="Webhook secret not configured")
        
        logger.info(f"🔔 Attempting to construct Stripe event with secret: {STRIPE_WEBHOOK_SECRET[:8]}...")
        print(f"🔔 Attempting to construct Stripe event with secret: {STRIPE_WEBHOOK_SECRET[:8]}...")
        
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
        
        logger.info(f"🔔 SUCCESS! Received Stripe webhook: {event['type']} (ID: {event.get('id', 'unknown')})")
        print(f"🔔 SUCCESS! Received Stripe webhook: {event['type']} (ID: {event.get('id', 'unknown')})")
        
        # Handle the event
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            logger.info(f"🔔 Processing checkout.session.completed for session: {session.get('id')}")
            print(f"🔔 Processing checkout.session.completed for session: {session.get('id')}")
            await handle_successful_payment(session)
        elif event['type'] == 'customer.subscription.created':
            subscription = event['data']['object']
            logger.info(f"🔔 Processing customer.subscription.created for subscription: {subscription.get('id')}")
            print(f"🔔 Processing customer.subscription.created for subscription: {subscription.get('id')}")
            await handle_subscription_created(subscription)
        elif event['type'] == 'invoice.payment_succeeded':
            invoice = event['data']['object']
            logger.info(f"🔔 Processing invoice.payment_succeeded for invoice: {invoice.get('id')}")
            print(f"🔔 Processing invoice.payment_succeeded for invoice: {invoice.get('id')}")
            await handle_subscription_renewal(invoice)
        elif event['type'] == 'customer.subscription.deleted':
            subscription = event['data']['object']
            logger.info(f"🔔 Processing customer.subscription.deleted for subscription: {subscription.get('id')}")
            print(f"🔔 Processing customer.subscription.deleted for subscription: {subscription.get('id')}")
            await handle_subscription_cancelled(subscription)
        elif event['type'] == 'customer.subscription.paused':
            subscription = event['data']['object']
            logger.info(f"🔔 Processing customer.subscription.paused for subscription: {subscription.get('id')}")
            print(f"🔔 Processing customer.subscription.paused for subscription: {subscription.get('id')}")
            await handle_subscription_paused(subscription)
        elif event['type'] == 'customer.subscription.updated':
            subscription = event['data']['object']
            logger.info(f"🔔 Processing customer.subscription.updated for subscription: {subscription.get('id')}")
            print(f"🔔 Processing customer.subscription.updated for subscription: {subscription.get('id')}")
            await handle_subscription_updated(subscription)
        elif event['type'] == 'customer.subscription.resumed':
            subscription = event['data']['object']
            logger.info(f"🔔 Processing customer.subscription.resumed for subscription: {subscription.get('id')}")
            print(f"🔔 Processing customer.subscription.resumed for subscription: {subscription.get('id')}")
            await handle_subscription_resumed(subscription)
        elif event['type'] == 'invoice.created':
            invoice = event['data']['object']
            logger.info(f"🔔 Processing invoice.created for invoice: {invoice.get('id')}")
            print(f"🔔 Processing invoice.created for invoice: {invoice.get('id')}")
            await handle_invoice_created(invoice)
        elif event['type'] == 'invoice.upcoming':
            invoice = event['data']['object']
            logger.info(f"🔔 Processing invoice.upcoming for invoice: {invoice.get('id')}")
            print(f"🔔 Processing invoice.upcoming for invoice: {invoice.get('id')}")
            await handle_invoice_upcoming(invoice)
        else:
            logger.info(f"ℹ️ Unhandled event type: {event['type']}")
            print(f"ℹ️ Unhandled event type: {event['type']}")
        
        logger.info(f"✅ Successfully processed webhook {event['type']}")
        print(f"✅ Successfully processed webhook {event['type']}")
        return {"status": "success"}
        
    except ValueError as e:
        logger.error(f"❌ Invalid webhook payload: {e}")
        print(f"❌ Invalid webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"❌ Invalid webhook signature: {e}")
        print(f"❌ Invalid webhook signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"❌ Webhook processing error: {str(e)}")
        logger.error(f"❌ Webhook traceback: {traceback.format_exc()}")
        print(f"❌ Webhook processing error: {str(e)}")
        print(f"❌ Webhook traceback: {traceback.format_exc()}")
        # Return 200 to prevent Stripe from retrying
        return {"status": "error", "message": str(e)}

'''
    
    # Replace the corrupted webhook function
    new_content = content[:webhook_start] + clean_webhook + content[webhook_end:]
    
    # Write back
    with open('backend/backend.py', 'w') as f:
        f.write(new_content)
    
    print('Webhook function completely rewritten!')
else:
    print('Could not find webhook function boundaries') 