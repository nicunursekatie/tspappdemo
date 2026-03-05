import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FeatureTooltip,
  TipTooltip,
  InfoTooltip,
} from './IntelligentGuideSystem';
import {
  FileText,
  Users,
  BarChart3,
  MessageSquare,
  Settings,
  HelpCircle,
  Sparkles,
  Target,
  Lightbulb,
} from 'lucide-react';

// Demo component to showcase the Smart Contextual Tooltip Guide System
export function SmartGuideDemo() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-slate-900">
                Smart Contextual Tooltip Guide System
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Interactive help system with role-based guidance and contextual
                tips
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Feature Demonstration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Collection Management */}
            <FeatureTooltip
              title="Record Collection Data"
              description="Start entering sandwich collection data. Choose between the quick form for experienced users or the step-by-step walkthrough for beginners. All data is automatically validated and saved."
              trigger="hover"
              placement="top"
            >
              <div
                className="p-4 border-2 border-dashed border-teal-200 hover:border-teal-400 rounded-lg cursor-pointer transition-all hover:bg-teal-50"
                data-guide="add-collection"
              >
                <FileText className="w-6 h-6 text-teal-600 mb-2" />
                <h3 className="font-semibold text-slate-900 mb-1">
                  Collections
                </h3>
                <p className="text-sm text-slate-600">Record sandwich data</p>
                <Badge variant="outline" className="mt-2 text-xs">
                  Feature Tooltip
                </Badge>
              </div>
            </FeatureTooltip>

            {/* User Management */}
            <InfoTooltip
              title="Team Management"
              description="Manage team members, assign roles, and control permissions. Only admins and core team members can access this section."
              trigger="hover"
              placement="top"
            >
              <div
                className="p-4 border-2 border-dashed border-brand-primary-border hover:border-blue-400 rounded-lg cursor-pointer transition-all hover:bg-brand-primary-lighter"
                data-guide="user-management"
              >
                <Users className="w-6 h-6 text-brand-primary mb-2" />
                <h3 className="font-semibold text-slate-900 mb-1">Users</h3>
                <p className="text-sm text-slate-600">Manage team members</p>
                <Badge variant="outline" className="mt-2 text-xs">
                  Info Tooltip
                </Badge>
              </div>
            </InfoTooltip>

            {/* Analytics Dashboard */}
            <TipTooltip
              title="Community Impact Analytics"
              description="View comprehensive reports showing your community's impact. Use the filters to focus on specific time periods or organizations. Pro tip: Schedule automated reports to save time!"
              trigger="hover"
              placement="top"
            >
              <div
                className="p-4 border-2 border-dashed border-yellow-200 hover:border-yellow-400 rounded-lg cursor-pointer transition-all hover:bg-yellow-50"
                data-guide="analytics"
              >
                <BarChart3 className="w-6 h-6 text-yellow-600 mb-2" />
                <h3 className="font-semibold text-slate-900 mb-1">Analytics</h3>
                <p className="text-sm text-slate-600">Track community impact</p>
                <Badge variant="outline" className="mt-2 text-xs">
                  Tip Tooltip
                </Badge>
              </div>
            </TipTooltip>

            {/* Team Communication */}
            <FeatureTooltip
              title="Team Chat & Messaging"
              description="Connect with your team through real-time chat, threads (project-centered messaging), and announcements. Different channels are available for different roles and purposes."
              trigger="hover"
              placement="bottom"
            >
              <div
                className="p-4 border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-lg cursor-pointer transition-all hover:bg-purple-50"
                data-guide="team-chat"
              >
                <MessageSquare className="w-6 h-6 text-purple-600 mb-2" />
                <h3 className="font-semibold text-slate-900 mb-1">Messages</h3>
                <p className="text-sm text-slate-600">Team communication</p>
                <Badge variant="outline" className="mt-2 text-xs">
                  Feature Tooltip
                </Badge>
              </div>
            </FeatureTooltip>

            {/* Settings */}
            <InfoTooltip
              title="System Settings"
              description="Configure your preferences, notification settings, and account options. Access admin settings if you have the appropriate permissions."
              trigger="hover"
              placement="bottom"
            >
              <div className="p-4 border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-lg cursor-pointer transition-all hover:bg-slate-50">
                <Settings className="w-6 h-6 text-slate-600 mb-2" />
                <h3 className="font-semibold text-slate-900 mb-1">Settings</h3>
                <p className="text-sm text-slate-600">Configure preferences</p>
                <Badge variant="outline" className="mt-2 text-xs">
                  Info Tooltip
                </Badge>
              </div>
            </InfoTooltip>

            {/* Help Center */}
            <TipTooltip
              title="Smart Help System"
              description="This intelligent help system provides contextual guidance based on your role and current activity. It learns from your usage patterns to offer personalized tips and shortcuts."
              trigger="hover"
              placement="bottom"
            >
              <div className="p-4 border-2 border-dashed border-green-200 hover:border-green-400 rounded-lg cursor-pointer transition-all hover:bg-green-50">
                <HelpCircle className="w-6 h-6 text-green-600 mb-2" />
                <h3 className="font-semibold text-slate-900 mb-1">
                  Smart Help
                </h3>
                <p className="text-sm text-slate-600">Contextual guidance</p>
                <Badge variant="outline" className="mt-2 text-xs">
                  Tip Tooltip
                </Badge>
              </div>
            </TipTooltip>
          </div>

          {/* Interactive Buttons */}
          <div className="border-t pt-6">
            <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-teal-600" />
              Interactive Examples
            </h4>
            <div className="flex flex-wrap gap-3">
              <FeatureTooltip
                title="New Collection Entry"
                description="Click to start recording a new sandwich collection. The system will guide you through the process step by step."
                trigger="hover"
                placement="top"
              >
                <Button
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                  data-guide="new-collection-btn"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Record New Collection
                </Button>
              </FeatureTooltip>

              <TipTooltip
                title="Keyboard Shortcut"
                description="Pro tip: Use Ctrl+N to quickly start a new collection entry from anywhere in the app!"
                trigger="hover"
                placement="top"
              >
                <Button
                  variant="outline"
                  className="border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Quick Entry (Ctrl+N)
                </Button>
              </TipTooltip>

              <InfoTooltip
                title="Generate Report"
                description="Create comprehensive reports showing community impact, volunteer participation, and collection trends."
                trigger="hover"
                placement="top"
              >
                <Button
                  variant="outline"
                  className="border-brand-primary-border text-brand-primary hover:bg-brand-primary-lighter"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </InfoTooltip>
            </div>
          </div>

          {/* System Features */}
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              Smart Guide System Features
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h5 className="font-medium text-slate-800">
                  Contextual Intelligence
                </h5>
                <ul className="space-y-1 text-slate-600">
                  <li>• Role-based guidance and tips</li>
                  <li>• Activity pattern recognition</li>
                  <li>• Personalized onboarding sequences</li>
                  <li>• Smart feature discovery</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h5 className="font-medium text-slate-800">
                  Interactive Features
                </h5>
                <ul className="space-y-1 text-slate-600">
                  <li>• Hover, click, and focus triggers</li>
                  <li>• Dismissible tooltips with memory</li>
                  <li>• Multi-step guided tours</li>
                  <li>• Progress tracking and completion</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
