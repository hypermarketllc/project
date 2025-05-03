import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { supabase } from '../../lib/supabase';
import { Loader2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Switch } from '@headlessui/react';
import clsx from 'clsx';

interface SystemSettings {
  name: string;
  logo_url?: string;
  advance_rate_default: number;
  referral_link?: string;
  referral_link_text?: string;
  collect_client_info: boolean;
  collect_policy_info: boolean;
  require_carrier_agent_numbers: boolean;
  allow_split_commissions: boolean;
  payouts_enabled: boolean;
  book_enabled: boolean;
}

const defaultSettings: SystemSettings = {
  name: 'MyAgentView',
  advance_rate_default: 0.75,
  collect_client_info: true,
  collect_policy_info: true,
  require_carrier_agent_numbers: false,
  allow_split_commissions: true,
  payouts_enabled: true,
  book_enabled: true,
};

const Settings = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const { data: currentSettings, isLoading } = useQuery('settings', async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'system_settings')
      .maybeSingle();

    if (error) throw error;
    return data?.value as SystemSettings || defaultSettings;
  });

  const updateSettings = useMutation(
    async (newSettings: SystemSettings) => {
      // First check if the bucket exists, if not create it
      const { data: buckets } = await supabase.storage.listBuckets();
      const logosBucket = buckets?.find(b => b.id === 'logos');
      
      if (!logosBucket) {
        const { error: createError } = await supabase.storage.createBucket('logos', {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif'],
          fileSizeLimit: 2097152, // 2MB in bytes
        });
        
        if (createError) {
          throw new Error(`Error creating bucket: ${createError.message}`);
        }
      }

      const { data, error } = await supabase.rpc('upsert_settings', {
        p_key: 'system_settings',
        p_value: newSettings,
        p_description: 'System-wide settings'
      });

      if (error) throw error;
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('settings');
        toast.success('Settings updated successfully');
      },
      onError: (error: any) => {
        toast.error(`Error updating settings: ${error.message}`);
        console.error('Error updating settings:', error);
      }
    }
  );

  React.useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    }
  }, [currentSettings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate(settings);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPEG, PNG, or GIF)');
      return;
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB in bytes
    if (file.size > maxSize) {
      toast.error('File size must be less than 2MB');
      return;
    }

    try {
      // Check if bucket exists
      const { data: buckets } = await supabase.storage.listBuckets();
      const logosBucket = buckets?.find(b => b.id === 'logos');
      
      if (!logosBucket) {
        const { error: createError } = await supabase.storage.createBucket('logos', {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif'],
          fileSizeLimit: 2097152, // 2MB in bytes
        });
        
        if (createError) {
          throw new Error(`Error creating bucket: ${createError.message}`);
        }
      }

      // Generate a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Delete old logo if exists
      if (settings.logo_url) {
        const oldFileName = settings.logo_url.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('logos')
            .remove([oldFileName]);
        }
      }

      // Upload new logo
      const { error: uploadError, data } = await supabase.storage
        .from('logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      // Update settings with new logo URL
      const newSettings = { ...settings, logo_url: publicUrl };
      setSettings(newSettings);
      await updateSettings.mutateAsync(newSettings);

      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error(error.message || 'Error uploading logo');
    } finally {
      setUploadProgress(0);
    }
  };

  const handleRemoveLogo = async () => {
    if (!settings.logo_url) return;

    try {
      const fileName = settings.logo_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('logos')
          .remove([fileName]);
      }

      const newSettings = { ...settings, logo_url: undefined };
      setSettings(newSettings);
      await updateSettings.mutateAsync(newSettings);

      toast.success('Logo removed successfully');
    } catch (error: any) {
      console.error('Error removing logo:', error);
      toast.error(error.message || 'Error removing logo');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="space-y-8 divide-y divide-gray-200">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
              <p className="mt-1 text-sm text-gray-500">
                Configure system-wide settings for your organization.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Company Name
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="MyAgentView"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Logo</label>
                <div className="mt-1 flex items-center space-x-4">
                  {settings.logo_url ? (
                    <div className="relative">
                      <img
                        src={settings.logo_url}
                        alt="Company logo"
                        className="h-12 w-12 object-contain rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Upload className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif"
                      onChange={handleFileChange}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      {uploadProgress > 0 ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Logo'}
                    </label>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Recommended: Square image, max 2MB (JPEG, PNG, or GIF)
                </p>
              </div>

              <div>
                <label htmlFor="advance_rate_default" className="block text-sm font-medium text-gray-700">
                  Default Advance Rate
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    name="advance_rate_default"
                    id="advance_rate_default"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.advance_rate_default}
                    onChange={(e) => setSettings({ ...settings, advance_rate_default: parseFloat(e.target.value) })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="referral_link" className="block text-sm font-medium text-gray-700">
                  Referral Link
                </label>
                <input
                  type="url"
                  name="referral_link"
                  id="referral_link"
                  value={settings.referral_link || ''}
                  onChange={(e) => setSettings({ ...settings, referral_link: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="https://example.com/refer"
                />
              </div>

              <div>
                <label htmlFor="referral_link_text" className="block text-sm font-medium text-gray-700">
                  Referral Link Text
                </label>
                <input
                  type="text"
                  name="referral_link_text"
                  id="referral_link_text"
                  value={settings.referral_link_text || ''}
                  onChange={(e) => setSettings({ ...settings, referral_link_text: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Refer a friend"
                />
              </div>

              <div className="space-y-4">
                <Switch.Group>
                  <div className="flex items-center justify-between">
                    <Switch.Label className="text-sm font-medium text-gray-700">
                      Collect Client Information
                    </Switch.Label>
                    <Switch
                      checked={settings.collect_client_info}
                      onChange={(checked) => setSettings({ ...settings, collect_client_info: checked })}
                      className={clsx(
                        settings.collect_client_info ? 'bg-primary-600' : 'bg-gray-200',
                        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
                      )}
                    >
                      <span
                        className={clsx(
                          settings.collect_client_info ? 'translate-x-5' : 'translate-x-0',
                          'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                        )}
                      />
                    </Switch>
                  </div>
                </Switch.Group>

                <Switch.Group>
                  <div className="flex items-center justify-between">
                    <Switch.Label className="text-sm font-medium text-gray-700">
                      Collect Policy Information
                    </Switch.Label>
                    <Switch
                      checked={settings.collect_policy_info}
                      onChange={(checked) => setSettings({ ...settings, collect_policy_info: checked })}
                      className={clsx(
                        settings.collect_policy_info ? 'bg-primary-600' : 'bg-gray-200',
                        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
                      )}
                    >
                      <span
                        className={clsx(
                          settings.collect_policy_info ? 'translate-x-5' : 'translate-x-0',
                          'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                        )}
                      />
                    </Switch>
                  </div>
                </Switch.Group>

                <Switch.Group>
                  <div className="flex items-center justify-between">
                    <Switch.Label className="text-sm font-medium text-gray-700">
                      Require Carrier Agent Numbers
                    </Switch.Label>
                    <Switch
                      checked={settings.require_carrier_agent_numbers}
                      onChange={(checked) => setSettings({ ...settings, require_carrier_agent_numbers: checked })}
                      className={clsx(
                        settings.require_carrier_agent_numbers ? 'bg-primary-600' : 'bg-gray-200',
                        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
                      )}
                    >
                      <span
                        className={clsx(
                          settings.require_carrier_agent_numbers ? 'translate-x-5' : 'translate-x-0',
                          'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                        )}
                      />
                    </Switch>
                  </div>
                </Switch.Group>

                <Switch.Group>
                  <div className="flex items-center justify-between">
                    <Switch.Label className="text-sm font-medium text-gray-700">
                      Allow Split Commissions
                    </Switch.Label>
                    <Switch
                      checked={settings.allow_split_commissions}
                      onChange={(checked) => setSettings({ ...settings, allow_split_commissions: checked })}
                      className={clsx(
                        settings.allow_split_commissions ? 'bg-primary-600' : 'bg-gray-200',
                        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
                      )}
                    >
                      <span
                        className={clsx(
                          settings.allow_split_commissions ? 'translate-x-5' : 'translate-x-0',
                          'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                        )}
                      />
                    </Switch>
                  </div>
                </Switch.Group>

                <Switch.Group>
                  <div className="flex items-center justify-between">
                    <Switch.Label className="text-sm font-medium text-gray-700">
                      Enable Payouts
                    </Switch.Label>
                    <Switch
                      checked={settings.payouts_enabled}
                      onChange={(checked) => setSettings({ ...settings, payouts_enabled: checked })}
                      className={clsx(
                        settings.payouts_enabled ? 'bg-primary-600' : 'bg-gray-200',
                        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
                      )}
                    >
                      <span
                        className={clsx(
                          settings.payouts_enabled ? 'translate-x-5' : 'translate-x-0',
                          'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                        )}
                      />
                    </Switch>
                  </div>
                </Switch.Group>

                <Switch.Group>
                  <div className="flex items-center justify-between">
                    <Switch.Label className="text-sm font-medium text-gray-700">
                      Enable Book
                    </Switch.Label>
                    <Switch
                      checked={settings.book_enabled}
                      onChange={(checked) => setSettings({ ...settings, book_enabled: checked })}
                      className={clsx(
                        settings.book_enabled ? 'bg-primary-600' : 'bg-gray-200',
                        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
                      )}
                    >
                      <span
                        className={clsx(
                          settings.book_enabled ? 'translate-x-5' : 'translate-x-0',
                          'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                        )}
                      />
                    </Switch>
                  </div>
                </Switch.Group>
              </div>
            </div>
          </div>

          <div className="pt-5">
            <div className="flex justify-end">
              <button
                type="submit"
                className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;