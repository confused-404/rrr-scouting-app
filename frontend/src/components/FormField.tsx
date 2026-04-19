import React, { useId, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, storage } from '../config/firebase';
import type { FormField as FormFieldType, SubmissionValue } from '../types/form.types';
import { compressImageFile } from '../utils/imageUpload';
import { isPictureFieldValue } from '../utils/formValues';
import { createLogger, formatErrorForLogging } from '../utils/logger';

interface FormFieldProps {
  field: FormFieldType;
  value: SubmissionValue;
  onChange: (value: SubmissionValue) => void;
  uploadContext?: {
    competitionId: string;
    formId: string;
  };
}

interface RankOrderFieldProps {
  field: FormFieldType;
  value: SubmissionValue;
  onChange: (value: SubmissionValue) => void;
}

const sanitizeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'photo.jpg';

const formFieldLogger = createLogger('FormField');

const RankOrderField: React.FC<RankOrderFieldProps> = ({ field, value, onChange }) => {
  const [showPopup, setShowPopup] = useState(false);
  const options = field.options ?? [];
  const ranked = Array.isArray(value)
    ? value.map((item) => String(item ?? '').trim()).filter((item) => item !== '')
    : [];

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

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowPopup(true)}
        className="w-full rounded-lg border-2 border-dashed border-gray-300 p-4 text-left transition-colors hover:border-blue-400 hover:bg-blue-50"
      >
        <div className="mb-1 text-sm font-medium text-gray-700">{field.label}</div>
        <div className="text-sm text-gray-500">
          {ranked.length === 0 ? 'Click to rank options' : `${ranked.length} item${ranked.length === 1 ? '' : 's'} ranked`}
        </div>
        {ranked.length > 0 && (
          <div className="mt-2 text-xs text-gray-600">
            {ranked.slice(0, 3).map((item, index) => (
              <span key={`${item}-${index}`} className="mr-2 inline-block">
                {index + 1}. {item}
              </span>
            ))}
            {ranked.length > 3 && <span>...and {ranked.length - 3} more</span>}
          </div>
        )}
      </button>

      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900">{field.label}</h3>
              <button
                type="button"
                onClick={() => setShowPopup(false)}
                className="text-gray-400 transition-colors hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex h-[calc(90vh-120px)] flex-col lg:flex-row">
              <div className="flex-1 overflow-hidden border-b border-gray-200 p-4 lg:border-b-0 lg:border-r">
                <h4 className="mb-3 text-sm font-medium text-gray-700">Available Options</h4>
                <div className="h-full space-y-2 overflow-y-auto">
                  {options.length > 0 ? options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => addOptionToEnd(option)}
                      className="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-left text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      {option}
                    </button>
                  )) : (
                    <p className="text-sm text-gray-500">No options configured for this field.</p>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-hidden p-4">
                <h4 className="mb-3 text-sm font-medium text-gray-700">Ranked Order</h4>
                <div className="h-full space-y-2 overflow-y-auto">
                  {ranked.length > 0 ? (
                    ranked.map((option, index) => (
                      <div
                        key={`${option}-${index}`}
                        className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 p-3"
                      >
                        <span className="w-8 text-sm font-semibold text-gray-700">{index + 1}.</span>
                        <span className="flex-1 text-sm">{option}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => moveItem(index, index - 1)}
                            disabled={index === 0}
                            className="p-1 text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Move up"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(index, index + 1)}
                            disabled={index === ranked.length - 1}
                            className="p-1 text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Move down"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAt(index)}
                            className="p-1 text-red-500 hover:text-red-700"
                            title="Remove"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-8 text-center text-sm text-gray-500">No items ranked yet. Click an option to add one.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button
                type="button"
                onClick={() => setShowPopup(false)}
                className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setUploadError('You must be logged in before uploading a picture.');
      formFieldLogger.warn('Picture upload blocked because no Firebase user is authenticated', {
        fieldId: field.id,
        competitionId: uploadContext.competitionId,
        formId: uploadContext.formId,
      });
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
      await currentUser.getIdToken();

      const compressedFile = await compressImageFile(file);
      const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`;
      const storedFileName = `${Date.now()}-${uniqueId}-${sanitizeFileName(compressedFile.name)}`;
      const storagePath = [
        'form-submissions',
        uploadContext.competitionId,
        uploadContext.formId,
        currentUser.uid,
        String(field.id),
        storedFileName,
      ].join('/');

      formFieldLogger.info('Starting picture upload', {
        fieldId: field.id,
        competitionId: uploadContext.competitionId,
        formId: uploadContext.formId,
        uid: currentUser.uid,
        path: storagePath,
        originalName: file.name,
        contentType: compressedFile.type,
        size: compressedFile.size,
      });

      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, compressedFile, {
        contentType: compressedFile.type,
        customMetadata: {
          originalName: file.name,
          ownerUid: currentUser.uid,
          ownerEmail: currentUser.email || '',
          competitionId: uploadContext.competitionId,
          formId: uploadContext.formId,
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
          () => resolve(undefined),
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
      formFieldLogger.info('Picture upload completed', {
        fieldId: field.id,
        competitionId: uploadContext.competitionId,
        formId: uploadContext.formId,
        uid: currentUser.uid,
        path: storagePath,
      });
    } catch (error) {
      const errorCode = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';

      formFieldLogger.error('Picture upload failed', {
        fieldId: field.id,
        competitionId: uploadContext.competitionId,
        formId: uploadContext.formId,
        uid: currentUser.uid,
        bucket: storage.app.options.storageBucket,
        error: formatErrorForLogging(error),
      });

      if (errorCode === 'storage/unauthorized') {
        setUploadError('Upload blocked by Firebase Storage rules for this signed-in user. The app now uploads to a user-scoped path, but your Storage rules must allow this user to write form submissions.');
      } else {
        setUploadError(error instanceof Error ? error.message : 'Picture upload failed.');
      }
    } finally {
      setIsUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleRemovePicture = () => {
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
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Your answer"
        />
      );

    case 'number':
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={typeof value === 'number' || typeof value === 'string' ? value : ''}
            onChange={(event) => {
              const raw = event.target.value;
              onChange(raw === '' ? '' : Number(raw));
            }}
            required={field.required}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
          {field.unit ? <span className="whitespace-nowrap text-sm text-gray-600">{field.unit}</span> : null}
        </div>
      );

    case 'ranking': {
      const min = Number.isFinite(field.min) ? Number(field.min) : 1;
      const max = Number.isFinite(field.max) ? Number(field.max) : 10;
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      const current = value === undefined || value === null || value === '' ? lo : Number(value);

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
            onChange={(event) => onChange(Number(event.target.value))}
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
          {options.map((option, index) => (
            <label key={index} className="flex items-center space-x-2">
              <input
                type="radio"
                name={`field-${field.id}`}
                value={option}
                checked={value === option}
                onChange={(event) => onChange(event.target.value)}
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
      const selected = Array.isArray(value) ? value.map((item) => String(item)) : [];
      return (
        <div className="space-y-2">
          {options.map((option, index) => {
            const checked = selected.includes(option);
            return (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? Array.from(new Set([...selected, option]))
                      : selected.filter((entry) => entry !== option);
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

    case 'rank_order':
      return <RankOrderField field={field} value={value} onChange={onChange} />;

    case 'picture':
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

    default:
      return null;
  }
};

export default FormField;
