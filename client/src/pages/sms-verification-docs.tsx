export default function SMSVerificationDocs() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-teal-600 p-3 rounded-full">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            SMS Notification Compliance Documentation
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            This page documents The Sandwich Project's SMS notification system compliance 
            with Twilio and telecommunications regulations.
          </p>
        </div>

        {/* PUBLIC OPT-IN PAGES - For Twilio reviewers */}
        <div className="border-4 border-green-500 rounded-lg overflow-hidden bg-green-50">
          <div className="bg-green-600 px-6 py-4">
            <h2 className="flex items-center gap-2 text-white text-xl font-semibold">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Live Opt-In Pages (Public URLs)
            </h2>
          </div>
          <div className="p-6 space-y-6">
            <p className="text-green-800 font-medium">
              We have two separate SMS campaigns with dedicated opt-in pages:
            </p>
            
            {/* Campaign 1: Host Collection Reminders */}
            <div className="bg-white p-4 rounded-lg border-2 border-green-300">
              <h3 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">Campaign 1</span>
                Host Weekly Collection Reminders
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                SMS reminders for hosts about weekly sandwich collection submissions.
              </p>
              <a 
                href="/sms-signup" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Host Reminders Page →
              </a>
              <p className="text-xs text-green-700 mt-2">
                <strong>URL:</strong> <code className="bg-green-100 px-2 py-0.5 rounded">/sms-signup</code>
              </p>
            </div>
            
            {/* Campaign 2: Event Coordination */}
            <div className="bg-white p-4 rounded-lg border-2 border-blue-300">
              <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">Campaign 2</span>
                Event Coordination (Volunteers + TSP Contacts)
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Event reminders, updates, and assignment notifications for organizers and volunteers.
              </p>
              <a 
                href="/sms-events" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Event Coordination Page →
              </a>
              <p className="text-xs text-blue-700 mt-2">
                <strong>URL:</strong> <code className="bg-blue-100 px-2 py-0.5 rounded">/sms-events</code>
              </p>
            </div>
            
            <p className="text-sm text-green-700">
              Both pages display complete opt-in forms with checkbox consent visible to all visitors.
              Users must authenticate only when submitting the form.
            </p>
          </div>
        </div>

        {/* Consent Process Overview */}
        <div className="border-2 border-teal-600 rounded-lg overflow-hidden bg-white">
          <div className="bg-teal-50 px-6 py-4">
            <h2 className="flex items-center gap-2 text-teal-800 text-xl font-semibold">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              User Consent Process
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Two-Step Verification Process:</h3>
              <ol className="list-decimal ml-6 space-y-2 text-gray-700">
                <li>User explicitly opts in through checkbox consent on their profile</li>
                <li>Verification code sent via SMS to confirm phone number ownership</li>
                <li>User must enter code or reply "YES" to complete enrollment</li>
              </ol>
            </div>
            
            <div className="bg-brand-primary-lighter border border-brand-primary-border rounded-lg p-4 flex gap-3">
              <svg className="h-5 w-5 text-brand-primary-muted flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-brand-primary-dark">
                Users must be authenticated and logged in to opt into SMS notifications, 
                ensuring identity verification and preventing unauthorized sign-ups.
              </p>
            </div>
          </div>
        </div>

        {/* Exact Consent Text */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exact Consent Language
            </h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Campaign 1 Consent */}
            <div>
              <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">Campaign 1</span>
                Host Weekly Collection Reminders
              </h3>
              <div className="bg-gray-100 p-6 rounded-lg border-2 border-green-300">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <input type="checkbox" defaultChecked disabled className="w-4 h-4" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-gray-900">
                      I consent to receive SMS text message reminders from The Sandwich Project 
                      about weekly collection submissions. I understand:
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1 ml-4">
                      <li>• Messages will only be sent for sandwich collection reminders</li>
                      <li>• I can unsubscribe at any time by replying <strong>STOP</strong></li>
                      <li>• Reply <strong>HELP</strong> for assistance</li>
                      <li>• Message frequency varies (up to 4 msgs/month)</li>
                      <li>• Message and data rates may apply</li>
                      <li>• My phone number will not be shared with third parties</li>
                      <li>• Carriers are not liable for delayed or undelivered messages</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Campaign 2 Consent */}
            <div>
              <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">Campaign 2</span>
                Event Coordination (Volunteers + TSP Contacts)
              </h3>
              <div className="bg-gray-100 p-6 rounded-lg border-2 border-blue-300">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <input type="checkbox" defaultChecked disabled className="w-4 h-4" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-gray-900">
                      I agree to receive SMS notifications from The Sandwich Project about event reminders, 
                      event updates, and assignment notifications related to events I am organizing or supporting. I understand:
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1 ml-4">
                      <li>• Messages will be sent for event coordination purposes only</li>
                      <li>• I can unsubscribe at any time by replying <strong>STOP</strong></li>
                      <li>• Reply <strong>HELP</strong> for assistance</li>
                      <li>• Message frequency varies based on event activity</li>
                      <li>• Message and data rates may apply</li>
                      <li>• My phone number will not be shared with third parties</li>
                      <li>• Carriers are not liable for delayed or undelivered messages</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              <span className="inline-block px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium mb-2">Required Checkbox</span>
              <p>Users must actively check the consent box to proceed with SMS enrollment for each campaign.</p>
            </div>
          </div>
        </div>

        {/* UI Screenshots */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              User Interface Elements
            </h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Dashboard Prompt */}
            <div className="space-y-3">
              <h3 className="font-semibold">1. Dashboard SMS Prompt</h3>
              <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-4 rounded-lg border-l-4 border-teal-600">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-teal-600 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      Stay up-to-date with SMS reminders
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Get text reminders when weekly sandwich counts are missing. Never miss a submission again!
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-md">
                        Set Up SMS Reminders
                      </button>
                      <button className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-md">
                        Maybe Later
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      ✓ Only sandwich collection reminders • Unsubscribe anytime • US numbers only
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Notifications Tab */}
            <div className="space-y-3">
              <h3 className="font-semibold">2. Profile Notifications Tab</h3>
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="space-y-4">
                  <div className="bg-brand-primary-lighter p-4 rounded-lg">
                    <h4 className="font-medium text-brand-primary-darker mb-2">
                      How SMS Reminders Work
                    </h4>
                    <ul className="text-sm text-brand-primary-dark space-y-1">
                      <li>• Get text reminders when weekly sandwich counts are missing</li>
                      <li>• Includes direct links to the app for easy submission</li>
                      <li>• Only used for sandwich collection reminders</li>
                      <li>• You can unsubscribe at any time</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone Number *</label>
                    <div className="relative">
                      <input 
                        type="tel" 
                        value="(XXX) XXX-XXXX" 
                        className="w-full px-3 py-2 border rounded-md"
                        disabled
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Example field - actual phone numbers are protected
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Opt-Out Instructions */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Opt-Out Methods & STOP/HELP Commands
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* SMS Commands */}
              <div className="bg-red-50 p-4 rounded-lg">
                <h3 className="font-semibold text-red-900 mb-3">
                  SMS Text Commands
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">STOP</span>
                    <span className="text-gray-700">
                      Immediately unsubscribe from all SMS notifications
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">HELP</span>
                    <span className="text-gray-700">
                      Receive information about the service and support contact
                    </span>
                  </div>
                </div>
              </div>

              {/* In-App Methods */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-3">
                  In-App Unsubscribe
                </h3>
                <ol className="list-decimal ml-4 space-y-1 text-sm text-gray-700">
                  <li>Go to Profile → Notifications tab</li>
                  <li>Click "Unsubscribe from SMS"</li>
                  <li>Confirmation message appears</li>
                  <li>No further messages will be sent</li>
                </ol>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <p>
                <strong>Standard Response to HELP:</strong><br />
                "The Sandwich Project SMS: Weekly collection reminders only. 
                Reply STOP to unsubscribe. Message frequency varies. 
                Msg&Data rates may apply. Support: admin@sandwich.project"
              </p>
            </div>
          </div>
        </div>

        {/* Message Types & Frequency */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Message Types & Frequency</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid gap-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold">Message Content</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Only sandwich collection submission reminders for missing weekly data
                </p>
              </div>
              
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold">Frequency</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Maximum of once per week, only when collection data is missing
                </p>
              </div>
              
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-semibold">Timing</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Sent during business hours (9 AM - 5 PM local time)
                </p>
              </div>

              <div className="border-l-4 border-orange-500 pl-4">
                <h3 className="font-semibold">Geographic Restriction</h3>
                <p className="text-sm text-gray-600 mt-1">
                  US phone numbers only (+1 country code)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Data Protection */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Data Protection & Privacy
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Phone numbers are encrypted in the database</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>No sharing with third parties except Twilio for delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Audit logs maintained for all opt-in/opt-out actions</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Immediate deletion upon user account removal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Links */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Legal & Compliance Links</h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              <a 
                href="/privacy-policy" 
                className="flex items-center gap-2 text-brand-primary-muted hover:underline"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Privacy Policy
              </a>
              <a 
                href="/terms-of-service" 
                className="flex items-center gap-2 text-brand-primary-muted hover:underline"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Terms of Service
              </a>
              <a 
                href="mailto:admin@sandwich.project" 
                className="flex items-center gap-2 text-brand-primary-muted hover:underline"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Contact Support: admin@sandwich.project
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-sm text-gray-500">
            This documentation page is maintained for compliance with Twilio and 
            telecommunications regulations.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Last updated: October 2025
          </p>
        </div>
      </div>
    </div>
  );
}
