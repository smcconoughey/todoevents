import React, { useState, useEffect } from 'react';
import { 
  Target, Brain, Network, TrendingUp, Users, AlertTriangle, 
  CheckCircle2, Clock, Zap, Plus, RefreshCw, GitBranch,
  BarChart3, Activity, Calendar, MessageSquare, Settings
} from 'lucide-react';
import { useMissionOps } from './MissionOpsContext';
import { useTheme } from '../ThemeContext';

const MissionOpsOverview = () => {
  const { theme } = useTheme();
  const { missions, isLoading, loadMissions } = useMissionOps();
  const [stats, setStats] = useState({
    totalMissions: 0,
    activeMissions: 0,
    completedTasks: 0,
    pendingInsights: 0,
    criticalRisks: 0,
    networkConnections: 0
  });

  useEffect(() => {
    calculateStats();
  }, [missions]);

  const calculateStats = () => {
    if (!missions || missions.length === 0) {
      setStats({
        totalMissions: 0,
        activeMissions: 0,
        completedTasks: 0,
        pendingInsights: 0,
        criticalRisks: 0,
        networkConnections: 0
      });
      return;
    }

    const totalMissions = missions.length;
    const activeMissions = missions.filter(m => m.status === 'active').length;
    const completedTasks = missions.reduce((sum, m) => sum + (m.tasks_count || 0), 0);
    const pendingInsights = missions.reduce((sum, m) => sum + (m.insight_count || 0), 0);
    const criticalRisks = missions.reduce((sum, m) => sum + (m.risk_count || 0), 0);
    const networkConnections = missions.reduce((sum, m) => sum + (m.relationship_count || 0), 0);

    setStats({
      totalMissions,
      activeMissions,
      completedTasks,
      pendingInsights,
      criticalRisks,
      networkConnections
    });
  };

  const StatCard = ({ icon: Icon, title, value, color, subtitle }) => (
    <div className={`
      p-6 rounded-xl border transition-all duration-200 hover:scale-105
      ${theme === 'light' 
        ? 'border-neutral-200 bg-white hover:shadow-lg' 
        : 'border-neutral-700/50 bg-neutral-800/30 hover:bg-neutral-700/30'
      }
    `}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${
            theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'
          }`}>
            {title}
          </p>
          <p className={`text-2xl font-bold mt-1 ${
            theme === 'light' ? 'text-neutral-900' : 'text-white'
          }`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-xs mt-1 ${
              theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'
            }`}>
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  const FeatureCard = ({ icon: Icon, title, description, comingSoon = false }) => (
    <div className={`
      p-4 rounded-lg border transition-all duration-200 hover:scale-102
      ${theme === 'light' 
        ? 'border-neutral-200 bg-neutral-50 hover:bg-white' 
        : 'border-neutral-700/50 bg-neutral-800/20 hover:bg-neutral-700/30'
      }
      ${comingSoon ? 'opacity-60' : ''}
    `}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${
          comingSoon ? 'bg-neutral-500' : 'bg-pin-blue'
        }`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h4 className={`font-medium ${
            theme === 'light' ? 'text-neutral-900' : 'text-white'
          }`}>
            {title}
            {comingSoon && (
              <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                theme === 'light' ? 'bg-neutral-200 text-neutral-600' : 'bg-neutral-700 text-neutral-400'
              }`}>
                Coming Soon
              </span>
            )}
          </h4>
          <p className={`text-sm mt-1 ${
            theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'
          }`}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className={`h-screen ${theme === 'light' ? 'bg-white' : 'bg-neutral-950'} flex items-center justify-center`}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-pin-blue border-t-transparent rounded-full animate-spin"></div>
          <p className={`${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>Loading MissionOps Overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${
      theme === 'light' ? 'bg-neutral-50' : 'bg-neutral-950'
    }`}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pin-blue to-purple-400 bg-clip-text text-transparent">
              MissionOps Command Center
            </h1>
            <p className={`mt-2 ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
              AI-powered mission planning and risk management
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadMissions}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'light' 
                  ? 'hover:bg-neutral-100' 
                  : 'hover:bg-neutral-800'
              }`}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button className={`p-2 rounded-lg transition-colors ${
              theme === 'light' 
                ? 'hover:bg-neutral-100' 
                : 'hover:bg-neutral-800'
            }`}>
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            icon={Target}
            title="Total Missions"
            value={stats.totalMissions}
            color="bg-pin-blue"
            subtitle="All missions"
          />
          <StatCard
            icon={Activity}
            title="Active Missions"
            value={stats.activeMissions}
            color="bg-green-500"
            subtitle="In progress"
          />
          <StatCard
            icon={CheckCircle2}
            title="Tasks"
            value={stats.completedTasks}
            color="bg-blue-500"
            subtitle="Total tasks"
          />
          <StatCard
            icon={Brain}
            title="AI Insights"
            value={stats.pendingInsights}
            color="bg-purple-500"
            subtitle="Generated insights"
          />
          <StatCard
            icon={AlertTriangle}
            title="Risks"
            value={stats.criticalRisks}
            color="bg-red-500"
            subtitle="Identified risks"
          />
          <StatCard
            icon={Network}
            title="Connections"
            value={stats.networkConnections}
            color="bg-orange-500"
            subtitle="Mission links"
          />
        </div>

        {/* Feature Grid */}
        <div>
          <h2 className={`text-xl font-semibold mb-6 ${
            theme === 'light' ? 'text-neutral-900' : 'text-white'
          }`}>
            Available Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={Target}
              title="Mission Planning"
              description="Create and organize missions with timeline-based positioning on an infinite grid"
            />
            <FeatureCard
              icon={Brain}
              title="AI Insights"
              description="Get AI-powered recommendations for risk analysis, priority optimization, and bottleneck detection"
            />
            <FeatureCard
              icon={Network}
              title="Mission Relationships"
              description="Connect missions with dependencies, blocks, and other relationship types"
            />
            <FeatureCard
              icon={CheckCircle2}
              title="Task Dependencies"
              description="Create complex task networks with finish-to-start, start-to-start dependencies"
            />
            <FeatureCard
              icon={GitBranch}
              title="Decision Workflows"
              description="Design decision trees and workflows with branching logic and conditional paths"
            />
            <FeatureCard
              icon={Users}
              title="Resource Management"
              description="Allocate people, equipment, and budget resources across tasks and missions"
            />
            <FeatureCard
              icon={AlertTriangle}
              title="Risk Assessment"
              description="Track risks with probability, impact scoring, and mitigation strategies"
            />
            <FeatureCard
              icon={BarChart3}
              title="Critical Path Analysis"
              description="Automatically calculate critical paths and identify schedule bottlenecks"
              comingSoon={true}
            />
            <FeatureCard
              icon={Calendar}
              title="Gantt Charts"
              description="Visualize project timelines with interactive Gantt chart views"
              comingSoon={true}
            />
            <FeatureCard
              icon={TrendingUp}
              title="Performance Analytics"
              description="Track mission success rates, resource utilization, and team performance"
              comingSoon={true}
            />
            <FeatureCard
              icon={MessageSquare}
              title="Collaboration Tools"
              description="Real-time chat, comments, and notifications for team coordination"
              comingSoon={true}
            />
            <FeatureCard
              icon={Zap}
              title="Automation Engine"
              description="Automate routine tasks, notifications, and status updates"
              comingSoon={true}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className={`text-xl font-semibold mb-6 ${
            theme === 'light' ? 'text-neutral-900' : 'text-white'
          }`}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button className={`
              p-4 rounded-lg border transition-all duration-200 hover:scale-105
              ${theme === 'light' 
                ? 'border-neutral-200 bg-white hover:shadow-lg text-neutral-900' 
            `}>
              <Plus className="w-8 h-8 mx-auto mb-2 text-pin-blue" />
              <h3 className="font-medium">New Mission</h3>
              <p className={`text-sm mt-1 ${
                theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'
              }`}>
                Start planning
              </p>
            </button>

            <button className={`
              p-4 rounded-lg border transition-all duration-200 hover:scale-105
              ${theme === 'light' 
                ? 'border-neutral-200 bg-white hover:shadow-lg text-neutral-900' 
            `}>
              <Brain className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <h3 className="font-medium">Generate Insights</h3>
              <p className={`text-sm mt-1 ${
                theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'
              }`}>
                AI analysis
              </p>
            </button>

            <button className={`
              p-4 rounded-lg border transition-all duration-200 hover:scale-105
              ${theme === 'light' 
                ? 'border-neutral-200 bg-white hover:shadow-lg text-neutral-900' 
            `}>
              <Network className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <h3 className="font-medium">Network View</h3>
              <p className={`text-sm mt-1 ${
                theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'
              }`}>
                See connections
              </p>
            </button>

            <button className={`
              p-4 rounded-lg border transition-all duration-200 hover:scale-105
              ${theme === 'light' 
                ? 'border-neutral-200 bg-white hover:shadow-lg text-neutral-900' 
            `}>
              <BarChart3 className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <h3 className="font-medium">Analytics</h3>
              <p className={`text-sm mt-1 ${
                theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'
              }`}>
                View reports
              </p>
            </button>
          </div>
        </div>

        {/* Getting Started */}
        {missions.length === 0 && (
          <div className={`
            p-8 rounded-xl border-2 border-dashed text-center
            ${theme === 'light' 
              ? 'border-neutral-300 bg-neutral-50' 
          `}>
            <Target className="w-12 h-12 mx-auto mb-4 text-pin-blue" />
            <h3 className={`text-xl font-semibold mb-2 ${
              theme === 'light' ? 'text-neutral-900' : 'text-white'
            }`}>
              Welcome to MissionOps
            </h3>
            <p className={`mb-6 ${
              theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'
            }`}>
              Get started by creating your first mission. Plan complex projects with AI-powered insights,
              track dependencies, and manage risks—all on an intuitive infinite grid.
            </p>
            <button className="px-6 py-3 bg-pin-blue text-white rounded-lg hover:bg-pin-blue-600 transition-colors font-medium">
              Create Your First Mission
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MissionOpsOverview;