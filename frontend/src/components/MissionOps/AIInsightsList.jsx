import React, { useState, useEffect } from 'react';
import { 
  Brain, AlertTriangle, CheckCircle2, Clock, Target, TrendingUp, 
  Users, Lightbulb, AlertCircle, Sparkles, Zap, Plus, RefreshCw,
  X, ThumbsUp, ThumbsDown, Eye, EyeOff
} from 'lucide-react';
import { useMissionOps } from './MissionOpsContext';

const AIInsightsList = ({ missionId, theme = 'dark' }) => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);

  const { } = useMissionOps();

  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (missionId) {
      loadInsights();
    }
  }, [missionId]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch(`${baseUrl}/missionops/missions/${missionId}/ai-insights`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load AI insights');
      }

      const data = await response.json();
      setInsights(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load AI insights:', error);
      setError(error.message || 'Failed to load AI insights');
      setInsights([]);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async () => {
    try {
      setGenerating(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch(`${baseUrl}/missionops/missions/${missionId}/ai-insights/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI insights');
      }

      await loadInsights(); // Refresh the insights list
    } catch (error) {
      console.error('Failed to generate AI insights:', error);
      setError(error.message || 'Failed to generate AI insights');
    } finally {
      setGenerating(false);
    }
  };

  const updateInsightStatus = async (insightId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${baseUrl}/missionops/ai-insights/${insightId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update insight status');
      }

      await loadInsights(); // Refresh the insights list
    } catch (error) {
      console.error('Failed to update insight status:', error);
      setError(error.message || 'Failed to update insight status');
    }
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'risk_analysis': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'priority_optimization': return <Target className="w-5 h-5 text-blue-500" />;
      case 'resource_conflict': return <Users className="w-5 h-5 text-orange-500" />;
      case 'timeline_analysis': return <Clock className="w-5 h-5 text-purple-500" />;
      case 'bottleneck_detection': return <TrendingUp className="w-5 h-5 text-yellow-500" />;
      default: return <Lightbulb className="w-5 h-5 text-green-500" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-100 border-green-200';
      default: return 'text-neutral-600 bg-neutral-100 border-neutral-200';
    }
  };

  const getPriorityColorDark = (priority) => {
    switch (priority) {
      case 'critical': return 'text-red-400 bg-red-900/30 border-red-500/30';
      case 'high': return 'text-orange-400 bg-orange-900/30 border-orange-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-900/30 border-yellow-500/30';
      case 'low': return 'text-green-400 bg-green-900/30 border-green-500/30';
      default: return 'text-neutral-400 bg-neutral-800/30 border-neutral-600/30';
    }
  };

  const formatInsightType = (type) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-pin-blue border-t-transparent rounded-full animate-spin"></div>
        <span className={`ml-2 text-sm ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
          Loading AI insights...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
        <p className="text-red-500 text-sm mb-2">{error}</p>
        <button
          onClick={loadInsights}
          className="px-3 py-1 text-sm bg-pin-blue text-white rounded hover:bg-pin-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Generate Insights Button */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-pin-blue" />
          <h3 className={`font-medium ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>
            AI Insights
          </h3>
        </div>
        
        <button
          onClick={generateInsights}
          disabled={generating}
          className={`flex items-center gap-2 px-3 py-1 text-sm rounded transition-colors ${
            generating 
              ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' 
              : 'bg-pin-blue text-white hover:bg-pin-blue-600'
          }`}
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Insights
            </>
          )}
        </button>
      </div>

      {/* Insights List */}
      {insights.length > 0 ? (
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`
                p-4 rounded-lg border transition-all duration-200
                ${theme === 'light' 
                  ? 'border-neutral-200 bg-white hover:bg-neutral-50' 
                  : 'border-neutral-700/50 bg-neutral-800/30 hover:bg-neutral-700/30'
                }
              `}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getInsightIcon(insight.insight_type)}
                  <h4 className={`font-medium ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>
                    {insight.title}
                  </h4>
                  <span className={`
                    px-2 py-1 text-xs rounded-full border
                    ${theme === 'light' 
                      ? getPriorityColor(insight.priority_level)
                      : getPriorityColorDark(insight.priority_level)
                    }
                  `}>
                    {insight.priority_level.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateInsightStatus(insight.id, 'addressed')}
                    className={`p-1 rounded ${theme === 'light' ? 'hover:bg-neutral-100' : 'hover:bg-neutral-600/50'} transition-colors`}
                    title="Mark as addressed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  </button>
                  <button
                    onClick={() => updateInsightStatus(insight.id, 'dismissed')}
                    className={`p-1 rounded hover:bg-red-500/10 text-red-500 transition-colors`}
                    title="Dismiss insight"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mb-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  theme === 'light' ? 'bg-neutral-100 text-neutral-600' : 'bg-neutral-700/50 text-neutral-300'
                }`}>
                  {formatInsightType(insight.insight_type)}
                </span>
                {insight.confidence_score && (
                  <span className={`text-xs ml-2 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    Confidence: {Math.round(insight.confidence_score * 100)}%
                  </span>
                )}
              </div>

              <p className={`text-sm mb-3 ${theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'}`}>
                {insight.content}
              </p>

              {insight.action_items && (
                <div className="space-y-1">
                  <p className={`text-xs font-medium ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
                    Recommended Actions:
                  </p>
                  <div className="space-y-1">
                    {JSON.parse(insight.action_items).map((action, index) => (
                      <div key={index} className={`text-xs flex items-center gap-2 ${
                        theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'
                      }`}>
                        <Zap className="w-3 h-3 text-pin-blue flex-shrink-0" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`text-xs mt-2 pt-2 border-t ${
                theme === 'light' ? 'border-neutral-200 text-neutral-500' : 'border-neutral-700/50 text-neutral-400'
              }`}>
                {new Date(insight.created_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`text-center py-8 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
          <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No AI insights yet</p>
          <p className="text-sm">Generate insights to get AI-powered recommendations</p>
        </div>
      )}
    </div>
  );
};

export default AIInsightsList;