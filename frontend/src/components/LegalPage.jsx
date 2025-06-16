import React, { useState } from 'react';
import { Shield, AlertCircle, FileText, Mail, UserCheck } from 'lucide-react';
import PrivacyRequestForm from './PrivacyRequestForm';

const LegalPage = () => {
  const [showPrivacyForm, setShowPrivacyForm] = useState(false);

  return (
    <div className="min-h-screen bg-themed-surface text-themed-primary">
      {/* Header */}
      <div className="bg-themed-surface border-b border-themed">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-spark-yellow" />
            <h1 className="text-3xl font-bold text-themed-primary">Legal Notice</h1>
          </div>
          <p className="text-themed-secondary">
            Effective Date: January 1, 2025<br />
            Last Updated: June 11, 2025
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        
        {/* Introduction */}
        <div className="bg-themed-surface border border-themed rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-500 mt-1 flex-shrink-0" />
            <div>
              <p className="text-themed-primary leading-relaxed">
                Welcome to Todo-Events ("we", "our", or "us"), a service operated by <strong>Watchtower AB, Inc</strong>.
                By accessing or using our website at <strong>https://todo-events.com</strong> or any services offered through it,
                you agree to the terms outlined in this Legal Notice. This page includes our policies on licensing, privacy, and content ownership.
              </p>
              <p className="text-themed-primary leading-relaxed mt-4 font-medium">
                If you do not agree to these terms, do not use the platform.
              </p>
            </div>
          </div>
        </div>

        {/* Early Access Platform Notice */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary">Early Access Platform Notice</h2>

          <div className="bg-themed-surface border border-themed rounded-lg p-6 space-y-3">
            <p className="text-themed-primary leading-relaxed">
              Todo-Events is currently in active development and provided as an early access service. Features may be incomplete,
              experimental, or subject to change without notice. We may modify or remove functionality at any time.
            </p>
            <ul className="space-y-2 text-themed-primary">
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                No guarantee of ongoing availability or feature stability
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Risk of data loss or service interruptions during this period
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                We reserve the right to discontinue features without notice
              </li>
            </ul>
          </div>
        </section>

        {/* Account Terms */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary">Account Terms</h2>

          <div className="bg-themed-surface border border-themed rounded-lg p-6 space-y-3">
            <ul className="space-y-2 text-themed-primary">
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Accounts require a valid email address and accurate information
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                We may suspend or terminate accounts for violations, abuse, or non-payment
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Account data may be retained for up to 30 days after closure for legal or compliance purposes
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Accounts are non-transferable
              </li>
            </ul>
          </div>
        </section>

        {/* Subscription & Billing Terms */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary">Subscription & Billing Terms</h2>

          <div className="bg-themed-surface border border-themed rounded-lg p-6 space-y-3">
            <p className="text-themed-primary leading-relaxed">
              We may offer trials at our discretion. Trials do not automatically convert to paid subscriptions and may be terminated at any time.
            </p>
            <ul className="space-y-2 text-themed-primary">
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Subscriptions renew automatically on a monthly or annual basis until cancelled
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Cancel anytime from your account dashboard; cancellations take effect at the end of the current billing period
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Pro‑rated refunds are provided for unused portions of annual plans
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                We may change prices with advance notice; current subscriptions remain at their existing rate for that term
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Applicable sales tax will be added where required by law
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Failed or overdue payments may result in suspension or termination of your account
              </li>
            </ul>
          </div>
        </section>

        {/* Acceptable Use Policy */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary">Acceptable Use Policy</h2>

          <div className="bg-themed-surface border border-themed rounded-lg p-6 space-y-3">
            <ul className="space-y-2 text-themed-primary">
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Do not post illegal events, harmful content, or spam
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Automated scraping or excessive API usage is prohibited
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                No harassment, impersonation, or malicious activity toward other users
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Events must contain accurate information and appropriate content
              </li>
            </ul>
          </div>
        </section>

        {/* Premium Features Acceptable Use */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-spark-yellow" />
            Premium Features Acceptable Use
          </h2>

          <div className="bg-themed-surface border border-themed rounded-lg p-6 space-y-4">
            <p className="text-themed-primary leading-relaxed">
              Premium and Enterprise subscriptions are subject to additional terms to ensure fair usage and prevent abuse of our service limits and billing system.
            </p>
            
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <h3 className="text-lg font-medium text-themed-primary mb-3">Prohibited Premium Feature Abuse:</h3>
              <ul className="space-y-2 text-themed-primary">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  <strong>One subscription per individual:</strong> Each person may only maintain one active Premium or Enterprise subscription at a time
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  <strong>No multiple accounts:</strong> Creating multiple accounts to circumvent the 10-event monthly Premium limit or avoid Enterprise subscription requirements is strictly prohibited
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  <strong>No limit circumvention:</strong> Using technical means, shared accounts, or coordinated accounts to exceed subscription limits
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  <strong>No subscription fraud:</strong> Manipulating billing cycles, payment methods, or subscription tiers to gain unauthorized access to premium features
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  <strong>No sharing credentials:</strong> Premium accounts are for individual use only and may not be shared with others
                </li>
              </ul>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <h3 className="text-lg font-medium text-themed-primary mb-3">Fair Usage Guidelines:</h3>
              <ul className="space-y-2 text-themed-primary">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  Premium subscriptions include up to 10 events per month with premium features
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  Users requiring more than 10 events per month should upgrade to Enterprise subscription
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  Business users, organizations, and commercial event organizers should use Enterprise subscriptions
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  Event limits reset monthly and unused events do not carry over to subsequent months
                </li>
              </ul>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h3 className="text-lg font-medium text-themed-primary mb-3">Enforcement & Consequences:</h3>
              <ul className="space-y-2 text-themed-primary">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  We actively monitor for subscription abuse and limit circumvention attempts
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  Violations may result in immediate account suspension, subscription cancellation, or billing adjustments
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  Repeated violations may result in permanent platform ban and legal action for subscription fraud
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  Users found in violation may be required to upgrade to appropriate subscription tier or pay usage fees
                </li>
              </ul>
            </div>

            <p className="text-themed-primary leading-relaxed">
              If you have questions about appropriate subscription tier for your usage needs, contact us at{' '}
              <a href="mailto:support@todo-events.com" className="text-pin-blue hover:underline">
                support@todo-events.com
              </a>{' '}
              before creating multiple accounts or attempting to circumvent subscription limits.
            </p>
          </div>
        </section>

        {/* Commercial Use & Licensing */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary flex items-center gap-2">
            <FileText className="w-6 h-6 text-spark-yellow" />
            Commercial Use & Licensing
          </h2>
          
          <div className="bg-themed-surface border border-themed rounded-lg p-6 space-y-4">
            <p className="text-themed-primary leading-relaxed">
              Todo-Events is a proprietary software platform owned and operated by Watchtower AB, Inc. 
              The software, platform, and all associated features—including mapping interfaces, admin dashboards, 
              premium tools, and private instances—are protected intellectual property.
            </p>
            
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <h3 className="text-lg font-medium text-themed-primary mb-3">You may not, under any circumstances:</h3>
              <ul className="space-y-2 text-themed-primary">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  Host your own copy or instance of Todo-Events
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  Clone or fork the software for private or public use
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  Access, replicate, or simulate any premium or private feature without explicit written authorization
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  Circumvent access controls, licensing requirements, or billing workflows
                </li>
              </ul>
            </div>
            
            <p className="text-themed-primary leading-relaxed">
              All commercial, institutional, or organizational use of Todo-Events requires a valid contract, 
              licensing agreement, or written approval from Watchtower AB, Inc.
            </p>
            
            <div className="bg-spark-yellow/10 border border-spark-yellow/20 rounded-lg p-4">
              <p className="text-themed-primary font-medium">
                For licensing or commercial use requests, please contact us at{' '}
                <a href="mailto:support@todo-events.com" className="text-pin-blue hover:underline">
                  support@todo-events.com
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Privacy Policy */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary">Privacy Policy</h2>
          
          <div className="bg-themed-surface border border-themed rounded-lg p-6 space-y-4">
            <p className="text-themed-primary leading-relaxed">
              We collect only the data necessary to operate, improve, and support the services we provide. Data may be processed for service delivery, analytics, and billing purposes.
            </p>
            <p className="text-themed-primary leading-relaxed">
              We retain event and account information while your account is active and for up to 30 days after closure, unless a longer period is required by law. Data may be processed on servers located in the United States and other jurisdictions.
            </p>
            
            <div>
              <h3 className="text-lg font-medium text-themed-primary mb-3">This may include:</h3>
              <ul className="space-y-2 text-themed-primary">
                <li className="flex items-start gap-2">
                  <span className="text-spark-yellow mt-1">•</span>
                  Data entered by users (e.g., event descriptions, locations, dates, schedules, vendor information)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-spark-yellow mt-1">•</span>
                  Basic usage metrics (e.g., page visits, device/browser type, interaction analytics)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-spark-yellow mt-1">•</span>
                  Contact information submitted for administrative or support purposes
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-spark-yellow mt-1">•</span>
                  Anonymous interest tracking and engagement data
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-spark-yellow mt-1">•</span>
                  Browser fingerprinting for anonymous user identification
                </li>
              </ul>
            </div>
            
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-themed-primary">
                <strong>We do not sell personal data to third parties.</strong> All data is stored securely and handled 
                in compliance with applicable laws.
              </p>
            </div>
            
            <p className="text-themed-primary leading-relaxed">
              If you submit personally identifiable information or data through the platform, you consent to its 
              collection and use for the intended purpose of delivering the service.
            </p>
          </div>
        </section>

        {/* Content Ownership */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary">Content Ownership</h2>
          
          <div className="bg-themed-surface border border-themed rounded-lg p-6 space-y-4">
            <p className="text-themed-primary leading-relaxed">
              By submitting or creating any event, listing, text, graphic, or service on Todo-Events, you agree to 
              <strong> irrevocably assign all associated rights and content ownership to Watchtower AB, Inc</strong>.
            </p>
            
            <div>
              <h3 className="text-lg font-medium text-themed-primary mb-3">This includes, without limitation:</h3>
              <ul className="space-y-2 text-themed-primary">
                <li className="flex items-start gap-2">
                  <span className="text-spark-yellow mt-1">•</span>
                  Event titles and descriptions
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-spark-yellow mt-1">•</span>
                  Uploaded images or icons
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-spark-yellow mt-1">•</span>
                  Fairground layouts, maps, and schedules
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-spark-yellow mt-1">•</span>
                  Vendor lists and program metadata
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-spark-yellow mt-1">•</span>
                  Any other material submitted to or generated by the platform
                </li>
              </ul>
            </div>
            
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <p className="text-themed-primary">
                By using Todo-Events, you waive any claim to copyright, license, attribution, or exclusivity in 
                connection with this content. This ensures consistency across the platform and supports its ongoing 
                development, security, and performance.
              </p>
            </div>
            
            <p className="text-themed-primary leading-relaxed">
              If you require a restricted-use agreement for special cases, contact{' '}
              <a href="mailto:support@todo-events.com" className="text-pin-blue hover:underline">
                support@todo-events.com
              </a>{' '}
              prior to submitting any content.
            </p>
          </div>
        </section>

        {/* Enforcement */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary">Enforcement</h2>
          
          <div className="bg-themed-surface border border-themed rounded-lg p-6">
            <p className="text-themed-primary leading-relaxed">
              Violations of these terms may result in suspension of access, permanent bans, or legal action. 
              We reserve the right to investigate any misuse of the platform and enforce our terms fully.
            </p>
          </div>
        </section>

        {/* California Privacy Rights (CCPA/CPRA) */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary">California Privacy Rights (CCPA/CPRA)</h2>
          
          <div className="bg-themed-surface border border-themed rounded-lg p-6 space-y-4">
            <p className="text-themed-primary leading-relaxed">
              If you are a California resident, you have specific rights regarding your personal information under the 
              California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA).
            </p>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-themed-primary mb-3">Your California Rights:</h3>
                <ul className="space-y-3 text-themed-primary">
                  <li className="flex items-start gap-2">
                    <span className="text-spark-yellow mt-1">•</span>
                    <div>
                      <strong>Right to Know/Access:</strong> Request a copy of the personal data we have collected about you, 
                      including categories of data, sources, business purposes, and third parties we share it with.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-spark-yellow mt-1">•</span>
                    <div>
                      <strong>Right to Delete:</strong> Request deletion of your personal data ("right to be forgotten"). 
                      We will process deletion requests within 45 days.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-spark-yellow mt-1">•</span>
                    <div>
                      <strong>Right to Opt-Out:</strong> Todo-Events does not sell personal data. However, you may contact us 
                      at support@todo-events.com to restrict data sharing with service providers.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-spark-yellow mt-1">•</span>
                    <div>
                      <strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights.
                    </div>
                  </li>
                </ul>
              </div>
              
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h4 className="font-medium text-themed-primary mb-2">How to Exercise Your Rights:</h4>
                <p className="text-themed-primary">
                  To exercise any of these rights, please email us at{' '}
                            <a href="mailto:support@todo-events.com" className="text-pin-blue hover:underline">
            support@todo-events.com
                  </a>{' '}
                  with "California Privacy Request" in the subject line. Include:
                </p>
                <ul className="mt-2 space-y-1 text-themed-primary text-sm">
                  <li>• Your full name and email address associated with your account</li>
                  <li>• Specific request type (access, deletion, opt-out)</li>
                  <li>• Verification information (we may request additional verification)</li>
                </ul>
              </div>
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <p className="text-themed-primary">
                  <strong>Response Time:</strong> We will respond to verified requests within 45 days. 
                  If additional time is needed, we will notify you and may extend the response period by an additional 45 days.
                </p>
              </div>

              {/* Privacy Request Button */}
              <div className="border-t border-themed pt-4">
                <button
                  onClick={() => setShowPrivacyForm(true)}
                  className="btn-yellow-themed flex items-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  Submit Privacy Request
                </button>
                <p className="text-xs text-themed-muted mt-2">
                  Secure form to exercise your California privacy rights (data access, deletion, or opt-out)
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Data We Collect (Detailed) */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary">Categories of Personal Information Collected</h2>
          
          <div className="bg-themed-surface border border-themed rounded-lg p-6">
            <div className="space-y-4">
              <p className="text-themed-primary leading-relaxed">
                For transparency and compliance, here are the specific categories of personal information we collect:
              </p>
              
              <div className="grid gap-4">
                <div className="border border-themed rounded-lg p-4">
                  <h4 className="font-medium text-themed-primary mb-2">Account Information</h4>
                  <p className="text-themed-secondary text-sm">Email address, name, password (encrypted), account preferences</p>
                </div>
                
                <div className="border border-themed rounded-lg p-4">
                  <h4 className="font-medium text-themed-primary mb-2">Usage Data</h4>
                  <p className="text-themed-secondary text-sm">Page visits, event interactions, interest clicks, session data, IP address</p>
                </div>
                
                <div className="border border-themed rounded-lg p-4">
                  <h4 className="font-medium text-themed-primary mb-2">Technical Information</h4>
                  <p className="text-themed-secondary text-sm">Browser type, device information, browser fingerprint (for anonymous users)</p>
                </div>
                
                <div className="border border-themed rounded-lg p-4">
                  <h4 className="font-medium text-themed-primary mb-2">Content Submitted</h4>
                  <p className="text-themed-secondary text-sm">Event details, descriptions, images, vendor information, reports submitted</p>
                </div>
                
                <div className="border border-themed rounded-lg p-4">
                  <h4 className="font-medium text-themed-primary mb-2">Location Data</h4>
                  <p className="text-themed-secondary text-sm">Event locations, approximate user location (for local events), IP-based location</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Service Availability & Limitations */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary">Service Availability & Limitations</h2>

          <div className="bg-themed-surface border border-themed rounded-lg p-6 space-y-3">
            <ul className="space-y-2 text-themed-primary">
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Service is provided on an "as-is" basis during early access with no uptime guarantees
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                Some advertised features may not be fully implemented or may change
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                You are responsible for backing up important event data
              </li>
            </ul>
          </div>
        </section>

        {/* Limitation of Liability */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary">Limitation of Liability</h2>

          <div className="bg-themed-surface border border-themed rounded-lg p-6 space-y-3">
            <p className="text-themed-primary leading-relaxed">
              To the maximum extent permitted by law, our liability is limited to the subscription fees you paid in the twelve months preceding the claim.
            </p>
            <ul className="space-y-2 text-themed-primary">
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                We are not liable for data loss, missed events, or business interruption
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spark-yellow mt-1">•</span>
                We are not responsible for failures caused by circumstances beyond our control or by third‑party services
              </li>
            </ul>
          </div>
        </section>

        {/* Termination */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary">Termination</h2>

          <div className="bg-themed-surface border border-themed rounded-lg p-6 space-y-3">
            <p className="text-themed-primary leading-relaxed">
              You may close your account at any time from the account dashboard or by contacting support. Upon termination your data will be deleted within 30 days, except where retention is required by law.
            </p>
            <p className="text-themed-primary leading-relaxed">
              Provisions relating to content ownership, limitation of liability, and dispute resolution survive account termination.
            </p>
          </div>
        </section>

        {/* Dispute Resolution */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary">Dispute Resolution</h2>

          <div className="bg-themed-surface border border-themed rounded-lg p-6 space-y-3">
            <p className="text-themed-primary leading-relaxed">
              Any disputes will be resolved through binding arbitration in California under the laws of the State of California.
            </p>
            <p className="text-themed-primary leading-relaxed">
              Legal notices may be sent to Watchtower AB, Inc at the address provided below.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-themed-primary flex items-center gap-2">
            <Mail className="w-6 h-6 text-spark-yellow" />
            Contact Information
          </h2>
          
          <div className="bg-themed-surface border border-themed rounded-lg p-6">
            <p className="text-themed-primary leading-relaxed mb-4">
              For all inquiries regarding these terms, licensing, or support:
            </p>
            
            <div className="space-y-2 text-themed-primary">
              <p><strong>General Inquiries:</strong> <a href="mailto:support@todo-events.com" className="text-pin-blue hover:underline">support@todo-events.com</a></p>
              <p><strong>Privacy Requests:</strong> <a href="mailto:support@todo-events.com" className="text-pin-blue hover:underline">support@todo-events.com</a></p>
              <p><strong>Company:</strong> Watchtower AB, Inc</p>
              <p><strong>Website:</strong> <a href="https://todo-events.com" className="text-pin-blue hover:underline">https://todo-events.com</a></p>
            </div>
            
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-themed-primary text-sm">
                <strong>California Residents:</strong> For privacy-related requests, please use support@todo-events.com 
                with "California Privacy Request" in the subject line.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center pt-8 pb-4">
          <p className="text-themed-muted text-sm">
            © 2025 Watchtower AB, Inc. All rights reserved.
          </p>
        </div>
      </div>

      {/* Privacy Request Dialog */}
      <PrivacyRequestForm 
        isOpen={showPrivacyForm} 
        onClose={() => setShowPrivacyForm(false)} 
      />
    </div>
  );
};

export default LegalPage; 