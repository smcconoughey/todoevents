import React, { useState, useContext } from 'react';
import { Upload, X, Image, Crown } from 'lucide-react';
import { AuthContext } from './EventMap/AuthContext';
import { API_URL } from '@/config';

const ImageUpload = ({ eventId, imageType, currentImage, onImageUpdate, onClose }) => {
  const { user, token } = useContext(AuthContext);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);

  const isPremium = user?.role === 'premium' || user?.role === 'admin' || user?.role === 'enterprise';

  const handleFileSelect = async (file) => {
    if (!file) return;

    // Validate file type - only JPG and PNG
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError('Please select a JPG or PNG image file only');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    await uploadImage(file);
  };

  const uploadImage = async (file) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const endpoint = imageType === 'banner' ? 'upload-banner' : 'upload-logo';
      const response = await fetch(`${API_URL}/events/${eventId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result = await response.json();
      onImageUpdate(result.filename);
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentImage) return;
    
    setUploading(true);
    setError(null);

    try {
      const endpoint = imageType === 'banner' ? 'banner' : 'logo';
      const response = await fetch(`${API_URL}/events/${eventId}/${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Delete failed');
      }

      onImageUpdate(null);
      onClose();
    } catch (error) {
      console.error('Delete error:', error);
      setError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  if (!isPremium) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              Premium Feature
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-600 mb-4">
            Image uploads are available for Premium and Enterprise subscribers.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600"
          >
            Upgrade to Premium
          </button>
        </div>
      </div>
    );
  }

  const recommendedSize = imageType === 'banner' ? '600x200px' : '200x200px';
  const title = imageType === 'banner' ? 'Upload Banner Image' : 'Upload Logo Image';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Recommended size: {recommendedSize}
          </p>
          <p className="text-xs text-gray-500">
            Supports JPG, PNG only • Max 5MB • Auto-compressed & resized
          </p>
        </div>

        {currentImage && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Current Image:</p>
            <div className="relative">
              <img
                src={`${API_URL}/uploads/${imageType === 'banner' ? 'banners' : 'logos'}/${currentImage}`}
                alt={`Current ${imageType}`}
                className="w-full h-32 object-cover rounded-lg border"
              />
              <button
                onClick={handleDelete}
                disabled={uploading}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="flex flex-col items-center">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-2">
              Drag and drop an image here, or click to select
            </p>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              className="hidden"
              id="image-upload"
              disabled={uploading}
            />
            <label
              htmlFor="image-upload"
              className={`px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 disabled:opacity-50 ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {uploading ? 'Uploading...' : 'Select Image'}
            </label>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            disabled={uploading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageUpload; 