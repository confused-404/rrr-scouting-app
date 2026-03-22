import React, { useId, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../config/firebase';
import type { FormField as FormFieldType } from '../types/form.types';
import { compressImageFile } from '../utils/imageUpload';
import { isPictureFieldValue } from '../utils/formValues';

interface FormFieldProps {
  field: FormFieldType;
  value: any;
  onChange: (value: any) => void;
  uploadContext?: {
    competitionId: string;
    formId: string;
  };
}

const sanitizeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'photo.jpg';

export const FormField: React.FC<FormFieldProps> = ({ field, value, onChange, uploadContext }) => {
  const fileInputId = useId();
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  const pictureValue = isPictureFieldValue(value) ? value : null;

  const uploadPicture = async (file: File) => {
    if (!uploadContext) {
      setUploadError('Upload context is missing for this form.');
      return;
    }

    if (!storage.app.options.storageBucket) {
      setUploadError('Firebase Storage is not configured. Add VITE_FIREBASE_STORAGE_BUCKET.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError('');

    try {
      const compressedFile = await compressImageFile(file);
      const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`;
      const storedFileName = `${Date.now()}-${uniqueId}-${sanitizeFileName(compressedFile.name)}`;
      const storagePath = [
        'form-submissions',
        uploadContext.competitionId,
        uploadContext.formId,
        String(field.id),
        storedFileName,
      ].join('/');

      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, compressedFile, {
        contentType: compressedFile.type,
        customMetadata: {
          originalName: file.name,
          fieldId: String(field.id),
        },
      });

      await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const percent = snapshot.totalBytes > 0
              ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              : 0;
            setUploadProgress(percent);
          },
          reject,
          () => resolve(undefined)
        );
      });

      const url = await getDownloadURL(uploadTask.snapshot.ref);

      if (pictureValue?.path && pictureValue.path !== storagePath) {
        deleteObject(ref(storage, pictureValue.path)).catch((error) => {
          console.warn('Failed to delete replaced picture upload:', error);
        });
      }

      onChange({
        url,
        path: storagePath,
        name: file.name,
        contentType: compressedFile.type,
        size: compressedFile.size,
        bucket: String(storage.app.options.storageBucket || ''),
        uploadedAt: new Date().toISOString(),
      });
      setUploadProgress(100);
    } catch (error) {
      console.error('Picture upload failed:', error);
      setUploadError(error instanceof Error ? error.message : 'Picture upload failed.');
    } finally {
      setIsUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleRemovePicture = async () => {
    setUploadError('');
    if (pictureValue?.path) {
      deleteObject(ref(storage, pictureValue.path)).catch((error) => {
        console.warn('Failed to delete picture upload:', error);
      });
    }
    setUploadProgress(0);
    onChange(undefined);
  };

  switch (field.type) {
    case 'text':
      return (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Your answer"
        />
      );

    case 'number':
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              onChange(raw === '' ? '' : Number(raw));
            }}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
          {field.unit ? <span className="text-sm text-gray-600 whitespace-nowrap">{field.unit}</span> : null}
        </div>
      );

    case 'ranking': {
      const min = Number.isFinite(field.min) ? Number(field.min) : 1;
      const max = Number.isFinite(field.max) ? Number(field.max) : 10;
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);

      const current =
        value === undefined || value === null || value === ''
          ? lo
          : Number(value);

      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{lo}</span>
            <span className="font-medium text-gray-900">{current}</span>
            <span>{hi}</span>
          </div>

          <input
            type="range"
            min={lo}
            max={hi}
            step={1}
            value={current}
            onChange={(e) => { onChange(Number(e.target.value)); }}
            className="w-full"
            aria-label={field.label}
          />

          <div className="text-xs text-gray-500">Selected: {current}</div>
        </div>
      );
    }

    case 'multiple_choice': {
      const options = field.options ?? [];
      return (
        <div className="space-y-2">
          {options.map((option, i) => (
            <label key={i} className="flex items-center space-x-2">
              <input
                type="radio"
                name={`field-${field.id}`}
                value={option}
                checked={value === option}
                onChange={(e) => onChange(e.target.value)}
                required={field.required}
                className="text-blue-600"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }

    case 'multiple_select': {
      const options = field.options ?? [];
      const selected: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {options.map((option, i) => {
            const checked = selected.includes(option);
            return (
              <label key={i} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? Array.from(new Set([...selected, option]))
                      : selected.filter((v) => v !== option);
                    onChange(next);
                  }}
                  className="text-blue-600"
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case 'rank_order': {
      const options = field.options ?? [];
      const ranked: string[] = Array.isArray(value)
        ? value.map((item) => String(item ?? '').trim()).filter((item) => item !== '')
        : [];

      const [showPopup, setShowPopup] = useState(false);

      const addOptionToEnd = (option: string) => {
        onChange([...ranked, option]);
      };

      const removeAt = (index: number) => {
        const next = [...ranked];
        next.splice(index, 1);
        onChange(next);
      };

      const moveItem = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || toIndex < 0) return;
        if (fromIndex >= ranked.length || toIndex >= ranked.length) return;

        const next = [...ranked];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        onChange(next);
      };

      const moveUp = (index: number) => {
        if (index > 0) {
          moveItem(index, index - 1);
        }
      };

      const moveDown = (index: number) => {
        if (index < ranked.length - 1) {
          moveItem(index, index + 1);
        }
      };

      return (
        <div>
          {/* Question display - clickable to open popup */}
          <button
            type="button"
            onClick={() => setShowPopup(true)}
            className="w-full text-left p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <div className="text-sm font-medium text-gray-700 mb-1">{field.label}</div>
            <div className="text-sm text-gray-500">
              {ranked.length === 0 ? 'Click to rank options' : `${ranked.length} item${ranked.length === 1 ? '' : 's'} ranked`}
            </div>
            {ranked.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                {ranked.slice(0, 3).map((item, i) => (
                  <span key={i} className="inline-block mr-2">
                    {i + 1}. {item}
                  </span>
                ))}
                {ranked.length > 3 && <span>...and {ranked.length - 3} more</span>}
              </div>
            )}
          </button>

          {/* Popup Modal */}
          {showPopup && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">{field.label}</h3>
                  <button
                    type="button"
                    onClick={() => setShowPopup(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex flex-col lg:flex-row h-[calc(90vh-80px)]">
                  {/* Left side - Options */}
                  <div className="flex-1 p-4 border-b lg:border-b-0 lg:border-r border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Available Options</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {options.length > 0 ? options.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => addOptionToEnd(option)}
                          className="w-full text-left px-3 py-2 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          {option}
                        </button>
                      )) : (
                        <p className="text-sm text-gray-500">No options configured for this field.</p>
                      )}
                    </div>
                  </div>

                  {/* Right side - Ranked List */}
                  <div className="flex-1 p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Ranked Order</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {ranked.length > 0 ? (
                        ranked.map((option, index) => (
                          <div
                            key={`${option}-${index}`}
                            className="flex items-center gap-2 p-3 bg-blue-50 rounded-md border border-blue-100"
                          >
                            <span className="w-8 text-sm font-semibold text-gray-700">{index + 1}.</span>
                            <span className="flex-1 text-sm">{option}</span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => moveUp(index)}
                                disabled={index === 0}
                                className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Move up"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => moveDown(index)}
                                disabled={index === ranked.length - 1}
                                className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Move down"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => removeAt(index)}
                                className="p-1 text-red-500 hover:text-red-700"
                                title="Remove"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-8">No items ranked yet. Click an option to add one.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowPopup(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    case 'picture': {
      return (
        <div className="space-y-3">
          <input
            id={`${fileInputId}-gallery`}
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                uploadPicture(file);
              }
            }}
          />

          <input
            id={`${fileInputId}-camera`}
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                uploadPicture(file);
              }
            }}
          />

          {pictureValue ? (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <img
                src={pictureValue.url}
                alt={field.label}
                className="h-56 w-full bg-gray-100 object-cover sm:h-72"
              />
              <div className="space-y-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{pictureValue.name || 'Uploaded picture'}</p>
                  <p className="text-xs text-gray-500">Tap upload again to replace this image.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isUploading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ImagePlus size={18} />
                    Replace Photo
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePicture}
                    disabled={isUploading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 size={18} />
                    Remove Photo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 sm:p-5">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Add a photo</p>
                  <p className="text-xs leading-relaxed text-gray-500">
                    Mobile users can open the camera directly or pick from the gallery. Images are compressed before upload.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isUploading}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Camera size={18} />
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isUploading}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ImagePlus size={18} />
                    Choose From Gallery
                  </button>
                </div>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">Uploading image... {uploadProgress}%</p>
            </div>
          )}

          {uploadError && (
            <p className="text-sm text-red-600">{uploadError}</p>
          )}
        </div>
      );
    }

    default:
      return null;
  }
};
export default FormField;