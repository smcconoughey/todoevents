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
              We collect only the data necessary to operate, improve, and support the services we provide.
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
                  <a href="mailto:privacy@todo-events.com" className="text-pin-blue hover:underline">
                    privacy@todo-events.com
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
              <p><strong>Privacy Requests:</strong> <a href="mailto:privacy@todo-events.com" className="text-pin-blue hover:underline">privacy@todo-events.com</a></p>
              <p><strong>Company:</strong> Watchtower AB, Inc</p>
              <p><strong>Website:</strong> <a href="https://todo-events.com" className="text-pin-blue hover:underline">https://todo-events.com</a></p>
            </div>
            
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-themed-primary text-sm">
                <strong>California Residents:</strong> For privacy-related requests, please use privacy@todo-events.com 
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