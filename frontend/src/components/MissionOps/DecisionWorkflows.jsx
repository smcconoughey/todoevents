import React, { useState, useEffect } from 'react';
import { 
  GitBranch, Plus, X, Circle, Diamond, Square, ArrowRight,
  CheckCircle2, AlertCircle, Clock, Edit, Trash2, Save
} from 'lucide-react';

const DecisionWorkflows = ({ missionId, theme = 'dark' }) => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    title: '',
    description: '',
    workflow_type: 'linear'
  });

  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (missionId) {
      loadWorkflows();
    }
  }, [missionId]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch(`${baseUrl}/missionops/missions/${missionId}/decision-workflows`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load decision workflows');
      }

      const data = await response.json();
      setWorkflows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load decision workflows:', error);
      setError(error.message || 'Failed to load decision workflows');
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  const createWorkflow = async (e) => {
    e.preventDefault();
    
    try {
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch(`${baseUrl}/missionops/decision-workflows`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mission_id: missionId,
          ...newWorkflow
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create decision workflow');
      }

      setShowCreateForm(false);
      setNewWorkflow({
        title: '',
        description: '',
        workflow_type: 'linear'
      });
      await loadWorkflows();
    } catch (error) {
      console.error('Failed to create decision workflow:', error);
      setError(error.message || 'Failed to create decision workflow');
    }
  };

  const getWorkflowIcon = (type) => {
    switch (type) {
      case 'linear': return <ArrowRight className="w-4 h-4 text-blue-500" />;
      case 'branching': return <GitBranch className="w-4 h-4 text-green-500" />;
      case 'parallel': return <Square className="w-4 h-4 text-purple-500" />;
      default: return <GitBranch className="w-4 h-4 text-neutral-500" />;
    }
  };

  const getNodeIcon = (type) => {
    switch (type) {
      case 'decision': return <Diamond className="w-4 h-4 text-yellow-500" />;
      case 'action': return <Circle className="w-4 h-4 text-blue-500" />;
      case 'condition': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'milestone': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default: return <Circle className="w-4 h-4 text-neutral-500" />;
    }
  };

  const formatWorkflowType = (type) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-pin-blue border-t-transparent rounded-full animate-spin"></div>
        <span className={`ml-2 text-sm ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
          Loading decision workflows...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-pin-blue" />
          <h3 className={`font-medium ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>
            Decision Workflows
          </h3>
        </div>
        
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-pin-blue text-white rounded hover:bg-pin-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      {/* Create Workflow Form */}
      {showCreateForm && (
        <form onSubmit={createWorkflow} className={`p-4 border rounded-lg ${
          theme === 'light' ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-700/50 bg-neutral-800/30'
        }`}>
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'
              }`}>
                Workflow Title
              </label>
              <input
                type="text"
                value={newWorkflow.title}
                onChange={(e) => setNewWorkflow({...newWorkflow, title: e.target.value})}
                className={`w-full px-3 py-2 rounded border ${
                  theme === 'light'
                    ? 'border-neutral-300 bg-white text-neutral-900'
                    : 'border-neutral-600 bg-neutral-700 text-white'
                } focus:outline-none focus:ring-2 focus:ring-pin-blue`}
                placeholder="e.g., Risk Assessment Process"
                required
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'
              }`}>
                Description
              </label>
              <textarea
                value={newWorkflow.description}
                onChange={(e) => setNewWorkflow({...newWorkflow, description: e.target.value})}
                rows={2}
                className={`w-full px-3 py-2 rounded border ${
                  theme === 'light'
                    ? 'border-neutral-300 bg-white text-neutral-900'
                    : 'border-neutral-600 bg-neutral-700 text-white'
                } focus:outline-none focus:ring-2 focus:ring-pin-blue`}
                placeholder="Describe the decision workflow..."
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'
              }`}>
                Workflow Type
              </label>
              <select
                value={newWorkflow.workflow_type}
                onChange={(e) => setNewWorkflow({...newWorkflow, workflow_type: e.target.value})}
                className={`w-full px-3 py-2 rounded border ${
                  theme === 'light'
                    ? 'border-neutral-300 bg-white text-neutral-900'
                    : 'border-neutral-600 bg-neutral-700 text-white'
                } focus:outline-none focus:ring-2 focus:ring-pin-blue`}
              >
                <option value="linear">Linear (Sequential)</option>
                <option value="branching">Branching (Conditional)</option>
                <option value="parallel">Parallel (Simultaneous)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-pin-blue text-white rounded hover:bg-pin-blue-600 transition-colors"
            >
              Create Workflow
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className={`px-4 py-2 border rounded transition-colors ${
                theme === 'light'
                  ? 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                  : 'border-neutral-600 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Workflows List */}
      {workflows.length > 0 ? (
        <div className="space-y-4">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className={`
                p-4 rounded-lg border transition-all duration-200
                ${theme === 'light' 
                  ? 'border-neutral-200 bg-white hover:bg-neutral-50' 
                  : 'border-neutral-700/50 bg-neutral-800/30 hover:bg-neutral-700/30'
                }
              `}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getWorkflowIcon(workflow.workflow_type)}
                    <h4 className={`font-medium ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>
                      {workflow.title}
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      theme === 'light' ? 'bg-neutral-100 text-neutral-600' : 'bg-neutral-700/50 text-neutral-300'
                    }`}>
                      {formatWorkflowType(workflow.workflow_type)}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      workflow.status === 'active' 
                        ? 'bg-green-100 text-green-600 border border-green-200' 
                        : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                    }`}>
                      {workflow.status}
                    </span>
                  </div>

                  {workflow.description && (
                    <p className={`text-sm mb-2 ${theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'}`}>
                      {workflow.description}
                    </p>
                  )}

                  <div className={`text-xs ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    {workflow.nodes?.length || 0} nodes • {workflow.connections?.length || 0} connections
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    className={`p-1 rounded ${theme === 'light' ? 'hover:bg-neutral-100' : 'hover:bg-neutral-600/50'} transition-colors`}
                    title="Edit workflow"
                  >
                    <Edit className="w-4 h-4 text-neutral-500" />
                  </button>
                  <button
                    className={`p-1 rounded hover:bg-red-500/10 text-red-500 transition-colors`}
                    title="Delete workflow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Nodes Preview */}
              {workflow.nodes && workflow.nodes.length > 0 && (
                <div className="space-y-2">
                  <h5 className={`text-sm font-medium ${theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'}`}>
                    Decision Nodes:
                  </h5>
                  <div className="space-y-1">
                    {workflow.nodes.slice(0, 3).map((node) => (
                      <div key={node.id} className="flex items-center gap-2 text-sm">
                        {getNodeIcon(node.node_type)}
                        <span className={theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'}>
                          {node.title}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          theme === 'light' ? 'bg-neutral-100 text-neutral-500' : 'bg-neutral-700/50 text-neutral-400'
                        }`}>
                          {node.node_type}
                        </span>
                      </div>
                    ))}
                    {workflow.nodes.length > 3 && (
                      <div className={`text-xs ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        +{workflow.nodes.length - 3} more nodes...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={`text-center py-8 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
          <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No decision workflows yet</p>
          <p className="text-sm">Create workflows to track decision processes</p>
        </div>
      )}
    </div>
  );
};

export default DecisionWorkflows;