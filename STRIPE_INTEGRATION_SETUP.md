# 🚀 Stripe Integration Setup Guide for TodoEvents

## ✅ What's Already Implemented

1. **Backend Changes**:
   - ✅ Added `stripe>=5.4.0` to requirements.txt
   - ✅ Added Stripe import and configuration variables
   - ✅ Added `/stripe/config` endpoint (already working)
   - ⚠️ Need to add remaining Stripe endpoints (see steps below)

2. **Frontend Changes**:
   - ✅ Updated AccountPage.jsx with Stripe checkout integration
   - ✅ Added upgrade button with loading states
   - ✅ Success/cancel redirect handling
   - ✅ Error handling and user feedback

## 🔧 Steps to Complete Setup

### Step 1: Set up Stripe Account

1. **Go to your Stripe Dashboard**
2. **Create a Product**:
   - Product name: "TodoEvents Premium"
   - Pricing: $20/month recurring
   - Copy the **Price ID** (starts with `price_...`)

3. **Create a Webhook Endpoint**:
   - URL: `https://your-render-app.onrender.com/stripe/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `customer.subscription.deleted`
   - Copy the **Webhook Signing Secret** (starts with `whsec_...`)

### Step 2: Add Environment Variables to Render

In your Render dashboard, add these environment variables:

```
STRIPE_SECRET_KEY=sk_test_... (or sk_live_ for production)
STRIPE_PUBLISHABLE_KEY=pk_test_... (or pk_live_ for production)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

### Step 3: Add Remaining Backend Endpoints

Add these endpoints to your `backend/backend.py` file after the existing `/stripe/config` endpoint:

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

### Step 4: Deploy and Test

1. **Deploy to Render** - Your app will automatically install the Stripe dependency
2. **Test in Stripe Test Mode**:
   - Use test API keys initially
   - Test the checkout flow
   - Test webhook functionality
3. **Go Live**:
   - Switch to live API keys when ready
   - Set up your bank account in Stripe for payouts

## 🧪 How to Test

1. **Frontend Testing**:
   - Go to `/account` page
   - Click "Upgrade to Premium"
   - You should be redirected to Stripe checkout
   - Use test card: `4242 4242 4242 4242`

2. **Backend Testing**:
   - Check logs for successful payment processing
   - Verify user role updates to "premium"
   - Test webhook endpoint receives events

## 🔒 Security Notes

- All sensitive Stripe keys are stored as environment variables
- Webhook signatures are validated for security
- Payment processing happens on Stripe's secure servers
- No card data touches your servers

## 📞 Support

If you encounter any issues:
1. Check the Render deployment logs
2. Verify all environment variables are set correctly
3. Test webhook endpoint with Stripe CLI
4. Check Stripe dashboard for payment events

## 🎉 What Users Experience

1. User clicks "Upgrade to Premium - $20/month" 
2. Redirects to Stripe's secure checkout page
3. After successful payment, returns to account page
4. User now has premium features (analytics, verified badges, etc.)
5. Automatic monthly billing via Stripe
6. Users can cancel anytime through your customer portal

Your Stripe integration is now ready! The system uses Stripe's hosted checkout page for maximum security and reliability.