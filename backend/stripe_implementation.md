# Stripe Integration Implementation for TodoEvents

## Environment Variables Needed

Add these to your Render deployment environment variables:

- `STRIPE_SECRET_KEY`: Your Stripe secret key (starts with sk_live_ or sk_test_)
- `STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key (starts with pk_live_ or pk_test_)
- `STRIPE_WEBHOOK_SECRET`: Your webhook endpoint secret (starts with whsec_)
- `STRIPE_PRICE_ID`: Your monthly subscription price ID (starts with price_)

## Additional Backend Endpoints to Add

Add these endpoints to backend.py after the existing `/stripe/config` endpoint:

```python
@app.post("/stripe/create-checkout-session")
async def create_checkout_session(current_user: dict = Depends(get_current_user)):
    """Create Stripe checkout session for premium subscription"""
    try:
        # Determine the base URL for success/cancel URLs
        base_url = "https://todoevents.onrender.com" if IS_PRODUCTION else "http://localhost:5173"
        
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': STRIPE_PRICE_ID,  # Your monthly subscription price ID
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f"{base_url}/account?session_id={{CHECKOUT_SESSION_ID}}&success=true",
            cancel_url=f"{base_url}/account?cancelled=true",
            customer_email=current_user['email'],
            metadata={
                'user_id': str(current_user['id']),
                'user_email': current_user['email']
            },
            subscription_data={
                'metadata': {
                    'user_id': str(current_user['id']),
                    'user_email': current_user['email']
                }
            }
        )
        
        return {"checkout_url": checkout_session.url}
        
    except Exception as e:
        logger.error(f"Error creating checkout session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        await handle_successful_payment(session)
    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        await handle_subscription_renewal(invoice)
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        await handle_subscription_cancelled(subscription)
    else:
        logger.info(f"Unhandled event type: {event['type']}")
    
    return {"status": "success"}

async def handle_successful_payment(session):
    """Handle successful payment from Stripe checkout"""
    try:
        user_id = int(session['metadata']['user_id'])
        user_email = session['metadata']['user_email']
        
        # Calculate expiration date (1 month from now)
        expires_at = datetime.now() + timedelta(days=30)
        
        # Update user to premium
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Update user role and expiration
            cursor.execute(f"""
                UPDATE users 
                SET role = 'premium', premium_expires_at = {placeholder}
                WHERE id = {placeholder}
            """, (expires_at, user_id))
            
            conn.commit()
            
            # Log the activity
            log_activity(user_id, "stripe_payment_success", f"Premium subscription activated via Stripe for {user_email}")
            
            logger.info(f"✅ Premium activated for user {user_id} ({user_email}) via Stripe payment")
            
            # Send premium notification email
            try:
                from email_config import email_service
                email_sent = email_service.send_premium_notification_email(
                    to_email=user_email,
                    user_name=user_email.split('@')[0],  # Use email prefix as name
                    expires_at=expires_at.isoformat(),
                    granted_by="Stripe Payment"
                )
                
                if email_sent:
                    logger.info(f"✅ Premium notification email sent to {user_email}")
                else:
                    logger.error(f"❌ Failed to send premium notification email to {user_email}")
            except Exception as e:
                logger.error(f"❌ Error sending premium notification email: {str(e)}")
        
    except Exception as e:
        logger.error(f"Error handling successful payment: {str(e)}")

async def handle_subscription_renewal(invoice):
    """Handle subscription renewal payments"""
    try:
        subscription_id = invoice['subscription']
        customer_id = invoice['customer']
        
        # Get subscription details to find user
        subscription = stripe.Subscription.retrieve(subscription_id)
        user_id = int(subscription['metadata']['user_id'])
        
        # Extend premium subscription by 1 month
        expires_at = datetime.now() + timedelta(days=30)
        
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            cursor.execute(f"""
                UPDATE users 
                SET premium_expires_at = {placeholder}
                WHERE id = {placeholder}
            """, (expires_at, user_id))
            
            conn.commit()
            
            log_activity(user_id, "stripe_renewal", f"Premium subscription renewed via Stripe")
            logger.info(f"✅ Premium renewed for user {user_id} via Stripe")
        
    except Exception as e:
        logger.error(f"Error handling subscription renewal: {str(e)}")

async def handle_subscription_cancelled(subscription):
    """Handle subscription cancellation"""
    try:
        user_id = int(subscription['metadata']['user_id'])
        
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Set role back to user and clear expiration
            cursor.execute(f"""
                UPDATE users 
                SET role = 'user', premium_expires_at = NULL
                WHERE id = {placeholder}
            """, (user_id,))
            
            conn.commit()
            
            log_activity(user_id, "stripe_cancellation", f"Premium subscription cancelled via Stripe")
            logger.info(f"✅ Premium cancelled for user {user_id} via Stripe")
        
    except Exception as e:
        logger.error(f"Error handling subscription cancellation: {str(e)}")
```

## Setup Instructions

### 1. Create Stripe Account Products
1. Go to your Stripe dashboard
2. Create a new Product called "TodoEvents Premium"
3. Add a monthly recurring price of $20
4. Copy the price ID (starts with `price_`)

### 2. Set up Webhook Endpoint
1. In Stripe dashboard, go to Webhooks
2. Add endpoint: `https://your-render-app.onrender.com/stripe/webhook`
3. Select these events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.deleted`
4. Copy the webhook signing secret

### 3. Environment Variables
Add these to your Render deployment:

```
STRIPE_SECRET_KEY=sk_live_... (or sk_test_ for testing)
STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_ for testing)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

### 4. Database Schema
Ensure your users table has these columns (they should already exist):
- `premium_expires_at` (TIMESTAMP)
- `premium_granted_by` (INTEGER)
- `premium_invited` (BOOLEAN)

## Frontend Integration
The frontend AccountPage.jsx has been updated with:
- Stripe checkout integration
- Success/cancel redirect handling
- Loading states
- Error handling

## Testing
1. Use Stripe test mode initially (test API keys)
2. Test successful payment flow
3. Test payment cancellation
4. Test webhook functionality
5. Switch to live mode when ready

## Security Notes
- All Stripe keys should be environment variables
- Webhook endpoint validates signatures
- User authentication required for checkout
- Payment processing happens on Stripe's servers