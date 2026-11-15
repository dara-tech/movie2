import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { 
  Upload, 
  Link as LinkIcon, 
  Type, 
  Trash2, 
  AlertCircle, 
  Loader2, 
  X, 
  Maximize2, 
  Minimize2, 
  FileImage,
  Sparkles,
  CheckCircle,
  Film
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface LogoData {
  logoUrl: string | null;
  type: 'upload' | 'url' | 'text';
  text: string;
}

interface SiteSettings {
  logo: LogoData;
  siteName: string;
  siteDescription: string;
  primaryColor: string;
}

const AdminLogoManagement: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'text'>('upload');
  const [logoUrl, setLogoUrl] = useState('');
  const [textLogoFirst, setTextLogoFirst] = useState('MOVIE');
  const [textLogoSecond, setTextLogoSecond] = useState('STREAM');
  const [addSpace, setAddSpace] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageInfo, setImageInfo] = useState<{width: number; height: number; size: number; type: string} | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.get('/api/site-settings');
      if (response.data.success) {
        const data = response.data.data;
        setSettings(data);
        if (data.logo?.textFirst !== undefined || data.logo?.textSecond !== undefined) {
          setTextLogoFirst(data.logo.textFirst || 'MOVIE');
          setTextLogoSecond(data.logo.textSecond || '');
          setAddSpace(data.logo.addSpace || false);
        } else {
          const logoText = data.logo?.text || 'MOVIESTREAM';
          const parts = logoText.split(' ');
          setTextLogoFirst(parts[0] || 'MOVIE');
          setTextLogoSecond(parts.slice(1).join(' ') || '');
        }
        setLogoUrl(data.logo?.type === 'url' ? data.logo.url : '');
        
        if (data.logo?.type === 'upload' && data.logo.url) {
          setPreviewUrl(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/uploads/logos/${data.logo.url}`);
        } else if (data.logo?.type === 'url' && data.logo.url) {
          setPreviewUrl(data.logo.url);
        } else {
          setPreviewUrl(null);
        }
      }
    } catch (error: any) {
      showToast('Failed to load logo settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressed = new File([blob], file.name, {
                  type: file.type,
                  lastModified: Date.now()
                });
                resolve(compressed);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            file.type,
            quality
          );
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be less than 10MB', 'error');
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImageInfo({
          width: img.width,
          height: img.height,
          size: file.size,
          type: file.type
        });
      };
      img.src = e.target?.result as string;
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    if (file.size > 500 * 1024) {
      try {
        const compressed = await compressImage(file);
        setCompressedFile(compressed);
      } catch (e) {
        setCompressedFile(null);
      }
    } else {
      setCompressedFile(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageInfo(null);
    setCompressedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    const fileToUpload = compressedFile || selectedFile;
    if (!fileToUpload) {
      showToast('Please select a file to upload', 'error');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('logo', fileToUpload);

      const response = await api.post('/api/site-settings/logo/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        }
      });

      if (response.data.success) {
        showToast('Logo uploaded successfully!', 'success');
        await fetchSettings();
        handleClearSelection();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to upload logo', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSetUrl = async () => {
    if (!logoUrl.trim()) {
      showToast('Please enter a valid URL', 'error');
      return;
    }

    setUploading(true);
    try {
      const response = await api.post('/api/site-settings/logo/url', { url: logoUrl.trim() });
      if (response.data.success) {
        showToast('Logo URL set successfully!', 'success');
        await fetchSettings();
        setPreviewUrl(logoUrl.trim());
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to set logo URL', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSetText = async () => {
    const firstPart = textLogoFirst.trim();
    const secondPart = textLogoSecond.trim();
    
    if (!firstPart && !secondPart) {
      showToast('Please enter at least one part of the logo text', 'error');
      return;
    }

    setUploading(true);
    try {
      const response = await api.post('/api/site-settings/logo/text', { 
        textFirst: firstPart,
        textSecond: secondPart,
        addSpace: addSpace
      });

      if (response.data.success) {
        showToast('Text logo set successfully!', 'success');
        await fetchSettings();
        setPreviewUrl(null);
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to set text logo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm('Are you sure you want to remove the logo? It will revert to default text.')) {
      return;
    }

    setUploading(true);
    try {
      const response = await api.delete('/api/site-settings/logo');
      if (response.data.success) {
        showToast('Logo removed successfully', 'success');
        await fetchSettings();
        setPreviewUrl(null);
        setLogoUrl('');
        setTextLogoFirst('MOVIE');
        setTextLogoSecond('STREAM');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to remove logo', 'error');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen color="red" text="Loading branding subsystem..." />;
  }

  const currentLogoType = settings?.logo?.type || 'text';
  const hasLogo = currentLogoType !== 'text' && previewUrl;

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Current Active Branding Display */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div className="flex items-center gap-2">
            <Film className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">Active Site Brand Preview</span>
          </div>
          <span className="sys-badge font-mono text-[10px]">
            Mode: {currentLogoType.toUpperCase()}
          </span>
        </div>

        <div className="ctrl-panel-body">
          <div className="flex flex-col items-center justify-center p-8 bg-zinc-950 border border-zinc-900 min-h-[160px]">
            {hasLogo ? (
              <div className="relative text-center">
                <img 
                  src={previewUrl!} 
                  alt="Current Logo" 
                  className="max-h-24 max-w-full object-contain mx-auto"
                  onError={() => setPreviewUrl(null)}
                />
                <div className="mt-3 text-[11px] font-mono text-zinc-500">
                  Source: {currentLogoType === 'upload' ? 'Local Asset' : 'CDN Origin'}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-3xl font-black tracking-tight font-mono mb-1">
                  <span className="text-zinc-100">{textLogoFirst || 'MOVIE'}</span>
                  {textLogoSecond && (
                    <span className="text-[var(--sys-cyan)]">{addSpace ? ' ' : ''}{textLogoSecond}</span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-zinc-500">Vector Glyph Fallback</span>
              </div>
            )}
          </div>

          {hasLogo && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleRemoveLogo}
                disabled={uploading}
                className="sys-btn sys-btn-danger"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                <span>Revert to Default Glyph</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Branding Configuration Controls */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header p-1.5 gap-1 bg-zinc-950/80">
          <button
            onClick={() => setActiveTab('upload')}
            className={`sys-btn ${activeTab === 'upload' ? 'sys-btn-primary' : ''}`}
          >
            <Upload className="w-3.5 h-3.5 mr-1" />
            Upload File
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`sys-btn ${activeTab === 'url' ? 'sys-btn-primary' : ''}`}
          >
            <LinkIcon className="w-3.5 h-3.5 mr-1" />
            External URI
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`sys-btn ${activeTab === 'text' ? 'sys-btn-primary' : ''}`}
          >
            <Type className="w-3.5 h-3.5 mr-1" />
            Typography Logo
          </button>
        </div>

        <div className="ctrl-panel-body">
          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                ref={dropZoneRef}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border border-dashed p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-[var(--sys-cyan)] bg-[var(--sys-cyan)]/5'
                    : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700'
                }`}
              >
                <input
                  id="logo-file"
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {!selectedFile ? (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="p-3 bg-zinc-900 border border-zinc-800 text-[var(--sys-cyan)]">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <label htmlFor="logo-file" className="text-xs font-medium text-zinc-200 cursor-pointer hover:text-[var(--sys-cyan)]">
                        {isDragging ? 'Release asset here' : 'Drop brand asset here or click to browse'}
                      </label>
                      <p className="text-[10px] text-zinc-500 font-mono mt-1">
                        PNG, JPG, SVG, WebP (Max 10MB, auto-compressed)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="sys-btn"
                    >
                      <FileImage className="w-3.5 h-3.5 mr-1.5" />
                      Browse File
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 text-left">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                      <div>
                        <div className="text-xs font-semibold text-zinc-100">{selectedFile.name}</div>
                        <div className="text-[10px] font-mono text-zinc-500">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowFullPreview(!showFullPreview)}
                          className="sys-btn"
                        >
                          {showFullPreview ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleClearSelection}
                          className="sys-btn"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-black border border-zinc-900 flex items-center justify-center">
                      <img 
                        src={previewUrl!} 
                        alt="Preview" 
                        className={`object-contain mx-auto ${showFullPreview ? 'max-h-72' : 'max-h-32'}`}
                      />
                    </div>

                    {imageInfo && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono">
                        <div className="p-2 bg-zinc-900/60 border border-zinc-800">
                          <span className="text-zinc-500 block">Resolution</span>
                          <span className="text-zinc-200">{imageInfo.width} × {imageInfo.height} px</span>
                        </div>
                        <div className="p-2 bg-zinc-900/60 border border-zinc-800">
                          <span className="text-zinc-500 block">MIME Type</span>
                          <span className="text-zinc-200">{imageInfo.type}</span>
                        </div>
                        <div className="p-2 bg-zinc-900/60 border border-zinc-800">
                          <span className="text-zinc-500 block">Original Size</span>
                          <span className="text-zinc-200">{(imageInfo.size / 1024).toFixed(1)} KB</span>
                        </div>
                        {compressedFile && (
                          <div className="p-2 bg-emerald-950/20 border border-emerald-800/40">
                            <span className="text-emerald-400 block">Optimized</span>
                            <span className="text-emerald-300">{(compressedFile.size / 1024).toFixed(1)} KB</span>
                          </div>
                        )}
                      </div>
                    )}

                    {uploading && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                          <span>Uploading payload...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-1">
                          <div className="bg-[var(--sys-cyan)] h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleUpload}
                        disabled={uploading || !selectedFile}
                        className="sys-btn sys-btn-primary flex-1"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 inline" />
                            Deploying...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5 mr-1.5 inline" />
                            Commit Logo Asset
                          </>
                        )}
                      </button>
                      {!uploading && (
                        <button
                          type="button"
                          onClick={handleClearSelection}
                          className="sys-btn"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* External URL Tab */}
          {activeTab === 'url' && (
            <div className="space-y-3">
              <div>
                <label className="sys-label">Static Asset URI</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://cdn.domain.com/static/logo.svg"
                  className="sys-input font-mono"
                />
                <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                  Provide a CORS-enabled, TLS-secured direct image address
                </span>
              </div>

              {logoUrl && (
                <div className="p-4 bg-black border border-zinc-900 text-center">
                  <img 
                    src={logoUrl} 
                    alt="Preview" 
                    className="max-h-24 max-w-full object-contain mx-auto"
                    onError={() => showToast('Failed to reach remote image address', 'error')}
                  />
                </div>
              )}

              <button
                onClick={handleSetUrl}
                disabled={uploading || !logoUrl.trim()}
                className="sys-btn sys-btn-primary"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 inline" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-3.5 h-3.5 mr-1.5 inline" />
                    Bind Remote Asset
                  </>
                )}
              </button>
            </div>
          )}

          {/* Text Tab */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="sys-label">Primary Wordmark</label>
                  <input
                    type="text"
                    value={textLogoFirst}
                    onChange={(e) => setTextLogoFirst(e.target.value.toUpperCase())}
                    placeholder="MOVIE"
                    maxLength={30}
                    className="sys-input font-mono font-bold tracking-wider"
                  />
                </div>
                <div>
                  <label className="sys-label">Secondary Accent</label>
                  <input
                    type="text"
                    value={textLogoSecond}
                    onChange={(e) => setTextLogoSecond(e.target.value.toUpperCase())}
                    placeholder="STREAM"
                    maxLength={30}
                    className="sys-input font-mono font-bold tracking-wider text-[var(--sys-cyan)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800">
                <div>
                  <div className="text-xs font-medium text-zinc-200">Delimiting Spacing</div>
                  <div className="text-[11px] text-zinc-500">Insert an explicit whitespace boundary between tokens</div>
                </div>
                <label className="sys-switch">
                  <input
                    type="checkbox"
                    checked={addSpace}
                    onChange={(e) => setAddSpace(e.target.checked)}
                  />
                  <span className="sys-slider" />
                </label>
              </div>

              <div className="p-6 bg-black border border-zinc-900 text-center">
                <div className="text-3xl font-black font-mono tracking-tight">
                  <span className="text-zinc-100">{textLogoFirst || 'MOVIE'}</span>
                  {textLogoSecond && (
                    <span className="text-[var(--sys-cyan)]">{addSpace ? ' ' : ''}{textLogoSecond}</span>
                  )}
                </div>
              </div>

              <button
                onClick={handleSetText}
                disabled={uploading || (!textLogoFirst.trim() && !textLogoSecond.trim())}
                className="sys-btn sys-btn-primary"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 inline" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Type className="w-3.5 h-3.5 mr-1.5 inline" />
                    Commit Typography Wordmark
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Guidelines telemetry note */}
      <div className="ctrl-panel p-3 bg-zinc-950/40">
        <div className="flex items-start gap-2.5 text-xs text-zinc-400">
          <AlertCircle className="w-4 h-4 text-[var(--sys-cyan)] shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-[11px] text-zinc-500 font-mono">
            <div>• Vector logos (SVG or transparent PNG) provide highest fidelity across retina viewports.</div>
            <div>• Optimal aspect ratio is ~3:1 or 4:1 with max bounding height of 48px in header bar.</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogoManagement;
