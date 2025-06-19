import React, { useState, useEffect } from 'react';
import { X, Target, Calendar, AlertCircle, Tag, Users } from 'lucide-react';
import { useTheme } from '../ThemeContext';

const CreateMissionModal = ({ 
  onClose, 
  onSubmit, 
  defaultPosition,
  yToDate 
}) => {
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    priority: 'medium',
    status: 'active',
    tags: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default start date based on position
  useEffect(() => {
    if (defaultPosition && yToDate) {
      const date = yToDate(defaultPosition.y);
      setFormData(prev => ({
        ...prev,
        start_date: date
      }));
    } else {
      // Default to today
      const today = new Date().toISOString().split('T')[0];
      setFormData(prev => ({
        ...prev,
        start_date: today
      }));
    }
  }, [defaultPosition, yToDate]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Mission title is required';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }

    if (formData.end_date && formData.start_date && 
        new Date(formData.end_date) < new Date(formData.start_date)) {
      newErrors.end_date = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Failed to create mission:', error);
      setErrors({ submit: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'text-green-400' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
    { value: 'high', label: 'High', color: 'text-orange-400' },
    { value: 'critical', label: 'Critical', color: 'text-red-400' }
  ];

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  return (
    <div 
      className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 missionops-modal ${
        theme === 'light' ? 'bg-black/30' : 
        theme === 'glass' ? 'bg-blue-500/10' : 'bg-black/50'
      }`}
      onClick={handleBackdropClick}
    >
      <div className={`
        rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border
        ${theme === 'light' ? 'bg-white border-gray-200' :
          theme === 'glass' ? 'bg-white/25 backdrop-blur-md border-white/20' :
          'bg-neutral-900 border-neutral-700'}
      `}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          theme === 'light' ? 'border-gray-200' :
          theme === 'glass' ? 'border-white/20' :
          'border-neutral-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              theme === 'light' ? 'bg-blue-50' :
              theme === 'glass' ? 'bg-blue-500/20' :
              'bg-blue-600/20'
            }`}>
              <Target className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className={`text-xl font-semibold ${
                theme === 'light' ? 'text-gray-900' :
                theme === 'glass' ? 'text-gray-900' :
                'text-white'
              }`}>Create New Mission</h2>
              <p className={`text-sm ${
                theme === 'light' ? 'text-gray-600' :
                theme === 'glass' ? 'text-gray-700' :
                'text-neutral-400'
              }`}>
                Define your mission objectives and timeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'light' ? 'hover:bg-gray-100' :
              theme === 'glass' ? 'hover:bg-white/20' :
              'hover:bg-neutral-800'
            }`}
          >
            <X className={`w-5 h-5 ${
              theme === 'light' ? 'text-gray-600' :
              theme === 'glass' ? 'text-gray-700' :
              'text-neutral-400'
            }`} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Mission Title */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              Mission Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`w-full px-4 py-3 bg-neutral-800 border rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
                errors.title ? 'border-red-500' : 'border-neutral-600'
              }`}
              placeholder="Enter mission title..."
              autoFocus
            />
            {errors.title && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {errors.title}
              </div>
            )}
          </div>

          {/* Mission Description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors resize-none"
              placeholder="Describe your mission objectives and scope..."
              rows={3}
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">
                Start Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleInputChange('start_date', e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 bg-neutral-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
                    errors.start_date ? 'border-red-500' : 'border-neutral-600'
                  }`}
                />
              </div>
              {errors.start_date && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {errors.start_date}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleInputChange('end_date', e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 bg-neutral-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
                    errors.end_date ? 'border-red-500' : 'border-neutral-600'
                  }`}
                />
              </div>
              {errors.end_date && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {errors.end_date}
                </div>
              )}
            </div>
          </div>

          {/* Priority and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => handleInputChange('priority', e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
              >
                {priorityOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              Tags
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => handleInputChange('tags', e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-800 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
                placeholder="Enter tags separated by commas..."
              />
            </div>
            <p className="text-xs text-neutral-400">
              Example: rocketry, propulsion, academic, urgent
            </p>
          </div>

          {/* Position Info */}
          {defaultPosition && (
            <div className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-1 bg-blue-600/20 rounded">
                  <Target className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-400 mb-1">
                    Grid Position
                  </h4>
                  <p className="text-xs text-neutral-300">
                    X: {Math.round(defaultPosition.x)}, Y: {Math.round(defaultPosition.y)}
                    <br />
                    This mission will be placed at your selected grid position.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-4 bg-red-600/10 border border-red-600/20 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">{errors.submit}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  Create Mission
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMissionModal;