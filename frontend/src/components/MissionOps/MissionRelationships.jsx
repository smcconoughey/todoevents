import React, { useState, useEffect } from 'react';
import { 
  Share2, ArrowRight, Link, Unlink, Plus, X, AlertTriangle, 
  CheckCircle2, Network, Target, Edit, Trash2, Search
} from 'lucide-react';
import { useMissionOps } from './MissionOpsContext';

const MissionRelationships = ({ missionId, theme = 'dark' }) => {
  const [relationships, setRelationships] = useState([]);
  const [availableMissions, setAvailableMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRelationship, setNewRelationship] = useState({
    to_mission_id: '',
    relationship_type: 'depends_on',
    dependency_type: 'hard',
    strength: 1.0,
    notes: ''
  });

  const { missions } = useMissionOps();
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (missionId) {
      loadRelationships();
    }
  }, [missionId]);

  useEffect(() => {
    // Filter out current mission from available missions
    const available = missions.filter(m => m.id !== missionId);
    setAvailableMissions(available);
  }, [missions, missionId]);

  const loadRelationships = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch(`${baseUrl}/missionops/missions/${missionId}/relationships`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load mission relationships');
      }

      const data = await response.json();
      setRelationships(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load mission relationships:', error);
      setError(error.message || 'Failed to load mission relationships');
      setRelationships([]);
    } finally {
      setLoading(false);
    }
  };

  const createRelationship = async (e) => {
    e.preventDefault();
    
    if (!newRelationship.to_mission_id) {
      setError('Please select a target mission');
      return;
    }

    try {
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch(`${baseUrl}/missionops/mission-relationships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_mission_id: missionId,
          ...newRelationship,
          to_mission_id: parseInt(newRelationship.to_mission_id)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create mission relationship');
      }

      setShowAddForm(false);
      setNewRelationship({
        to_mission_id: '',
        relationship_type: 'depends_on',
        dependency_type: 'hard',
        strength: 1.0,
        notes: ''
      });
      await loadRelationships();
    } catch (error) {
      console.error('Failed to create mission relationship:', error);
      setError(error.message || 'Failed to create mission relationship');
    }
  };

  const deleteRelationship = async (relationshipId) => {
    if (!window.confirm('Are you sure you want to remove this relationship?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${baseUrl}/missionops/mission-relationships/${relationshipId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete mission relationship');
      }

      await loadRelationships();
    } catch (error) {
      console.error('Failed to delete mission relationship:', error);
      setError(error.message || 'Failed to delete mission relationship');
    }
  };

  const getRelationshipIcon = (type) => {
    switch (type) {
      case 'depends_on': return <ArrowRight className="w-4 h-4 text-blue-500" />;
      case 'blocks': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'related_to': return <Link className="w-4 h-4 text-green-500" />;
      case 'duplicates': return <Target className="w-4 h-4 text-yellow-500" />;
      case 'splits_from': return <Network className="w-4 h-4 text-purple-500" />;
      default: return <Link className="w-4 h-4 text-neutral-500" />;
    }
  };

  const getRelationshipColor = (type) => {
    switch (type) {
      case 'depends_on': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'blocks': return 'text-red-600 bg-red-100 border-red-200';
      case 'related_to': return 'text-green-600 bg-green-100 border-green-200';
      case 'duplicates': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'splits_from': return 'text-purple-600 bg-purple-100 border-purple-200';
      default: return 'text-neutral-600 bg-neutral-100 border-neutral-200';
    }
  };

  const getRelationshipColorDark = (type) => {
    switch (type) {
      case 'depends_on': return 'text-blue-400 bg-blue-900/30 border-blue-500/30';
      case 'blocks': return 'text-red-400 bg-red-900/30 border-red-500/30';
      case 'related_to': return 'text-green-400 bg-green-900/30 border-green-500/30';
      case 'duplicates': return 'text-yellow-400 bg-yellow-900/30 border-yellow-500/30';
      case 'splits_from': return 'text-purple-400 bg-purple-900/30 border-purple-500/30';
      default: return 'text-neutral-400 bg-neutral-800/30 border-neutral-600/30';
    }
  };

  const formatRelationshipType = (type) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-pin-blue border-t-transparent rounded-full animate-spin"></div>
        <span className={`ml-2 text-sm ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
          Loading relationships...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-pin-blue" />
          <h3 className={`font-medium ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>
            Mission Relationships
          </h3>
        </div>
        
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-pin-blue text-white rounded hover:bg-pin-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Relationship
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      {/* Add Relationship Form */}
      {showAddForm && (
        <form onSubmit={createRelationship} className={`p-4 border rounded-lg ${
          theme === 'light' ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-700/50 bg-neutral-800/30'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'
              }`}>
                Target Mission
              </label>
              <select
                value={newRelationship.to_mission_id}
                onChange={(e) => setNewRelationship({...newRelationship, to_mission_id: e.target.value})}
                className={`w-full px-3 py-2 rounded border ${
                  theme === 'light'
                    ? 'border-neutral-300 bg-white text-neutral-900'
                    : 'border-neutral-600 bg-neutral-700 text-white'
                } focus:outline-none focus:ring-2 focus:ring-pin-blue`}
                required
              >
                <option value="">Select a mission...</option>
                {availableMissions.map((mission) => (
                  <option key={mission.id} value={mission.id}>
                    {mission.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'
              }`}>
                Relationship Type
              </label>
              <select
                value={newRelationship.relationship_type}
                onChange={(e) => setNewRelationship({...newRelationship, relationship_type: e.target.value})}
                className={`w-full px-3 py-2 rounded border ${
                  theme === 'light'
                    ? 'border-neutral-300 bg-white text-neutral-900'
                    : 'border-neutral-600 bg-neutral-700 text-white'
                } focus:outline-none focus:ring-2 focus:ring-pin-blue`}
              >
                <option value="depends_on">Depends On</option>
                <option value="blocks">Blocks</option>
                <option value="related_to">Related To</option>
                <option value="duplicates">Duplicates</option>
                <option value="splits_from">Splits From</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'
              }`}>
                Dependency Type
              </label>
              <select
                value={newRelationship.dependency_type}
                onChange={(e) => setNewRelationship({...newRelationship, dependency_type: e.target.value})}
                className={`w-full px-3 py-2 rounded border ${
                  theme === 'light'
                    ? 'border-neutral-300 bg-white text-neutral-900'
                    : 'border-neutral-600 bg-neutral-700 text-white'
                } focus:outline-none focus:ring-2 focus:ring-pin-blue`}
              >
                <option value="hard">Hard Dependency</option>
                <option value="soft">Soft Dependency</option>
                <option value="informational">Informational</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'
              }`}>
                Strength (0.0 - 1.0)
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={newRelationship.strength}
                onChange={(e) => setNewRelationship({...newRelationship, strength: parseFloat(e.target.value)})}
                className={`w-full px-3 py-2 rounded border ${
                  theme === 'light'
                    ? 'border-neutral-300 bg-white text-neutral-900'
                    : 'border-neutral-600 bg-neutral-700 text-white'
                } focus:outline-none focus:ring-2 focus:ring-pin-blue`}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className={`block text-sm font-medium mb-1 ${
              theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'
            }`}>
              Notes
            </label>
            <textarea
              value={newRelationship.notes}
              onChange={(e) => setNewRelationship({...newRelationship, notes: e.target.value})}
              rows={2}
              className={`w-full px-3 py-2 rounded border ${
                theme === 'light'
                  ? 'border-neutral-300 bg-white text-neutral-900'
                  : 'border-neutral-600 bg-neutral-700 text-white'
              } focus:outline-none focus:ring-2 focus:ring-pin-blue`}
              placeholder="Optional notes about this relationship..."
            />
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-pin-blue text-white rounded hover:bg-pin-blue-600 transition-colors"
            >
              Create Relationship
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
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

      {/* Relationships List */}
      {relationships.length > 0 ? (
        <div className="space-y-3">
          {relationships.map((relationship) => (
            <div
              key={relationship.id}
              className={`
                p-4 rounded-lg border transition-all duration-200
                ${theme === 'light' 
                  ? 'border-neutral-200 bg-white hover:bg-neutral-50' 
                  : 'border-neutral-700/50 bg-neutral-800/30 hover:bg-neutral-700/30'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getRelationshipIcon(relationship.relationship_type)}
                    <span className={`
                      px-2 py-1 text-xs rounded-full border
                      ${theme === 'light' 
                        ? getRelationshipColor(relationship.relationship_type)
                        : getRelationshipColorDark(relationship.relationship_type)
                      }
                    `}>
                      {formatRelationshipType(relationship.relationship_type)}
                    </span>
                    {relationship.dependency_type && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        theme === 'light' ? 'bg-neutral-100 text-neutral-600' : 'bg-neutral-700/50 text-neutral-300'
                      }`}>
                        {relationship.dependency_type}
                      </span>
                    )}
                  </div>

                  <div className="text-sm mb-2">
                    <span className={`font-medium ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>
                      {relationship.from_mission_id === missionId ? 'This mission' : relationship.from_mission_title}
                    </span>
                    <ArrowRight className="inline-block w-4 h-4 mx-2 text-neutral-400" />
                    <span className={`font-medium ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>
                      {relationship.to_mission_id === missionId ? 'This mission' : relationship.to_mission_title}
                    </span>
                  </div>

                  {relationship.strength !== 1.0 && (
                    <div className={`text-xs ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
                      Strength: {relationship.strength}
                    </div>
                  )}

                  {relationship.notes && (
                    <p className={`text-sm mt-2 ${theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'}`}>
                      {relationship.notes}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => deleteRelationship(relationship.id)}
                  className={`p-1 rounded hover:bg-red-500/10 text-red-500 transition-colors`}
                  title="Remove relationship"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`text-center py-8 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
          <Network className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No mission relationships yet</p>
          <p className="text-sm">Connect this mission to others to track dependencies</p>
        </div>
      )}
    </div>
  );
};

export default MissionRelationships;