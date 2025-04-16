import React from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { supabase } from '../lib/supabase';
import { Carrier, Product, Deal } from '../types/database';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

type DealFormData = {
  carrier_id: string;
  product_id: string;
  effective_date: string;
  monthly_premium: number;
  annual_premium: number;
  client_name: string;
  client_phone?: string;
  policy_number?: string;
  app_number?: string;
  split_agent_id?: string;
  split_percentage?: number;
  referral_count?: number;
  lead_source: 'referral' | 'free_lead' | 'self_generated';
};

const PostDeal = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<DealFormData>({
    defaultValues: {
      lead_source: 'free_lead', // Set default to free lead
      referral_count: 0
    }
  });

  const selectedCarrierId = watch('carrier_id');

  const { data: carriers, isLoading: carriersLoading } = useQuery<Carrier[]>('carriers', async () => {
    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>(
    ['products', selectedCarrierId],
    async () => {
      if (!selectedCarrierId) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('carrier_id', selectedCarrierId)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    {
      enabled: !!selectedCarrierId,
    }
  );

  const createDeal = useMutation(
    async (data: DealFormData) => {
      if (!user?.id) {
        throw new Error('No authenticated user');
      }

      const { data: deal, error } = await supabase
        .from('deals')
        .insert([{
          agent_id: user.id,
          carrier_id: data.carrier_id,
          product_id: data.product_id,
          effective_date: data.effective_date,
          annual_premium: data.annual_premium,
          client_name: data.client_name,
          client_phone: data.client_phone || null,
          policy_number: data.policy_number || null,
          app_number: data.app_number || null,
          status: 'Pending',
          from_referral: data.lead_source === 'referral'
        }])
        .select()
        .single();

      if (error) throw error;
      return deal;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('deals');
        reset();
        toast.success('Deal submitted successfully');
      },
      onError: (error: any) => {
        console.error('Error creating deal:', error);
        toast.error(`Failed to submit deal: ${error.message}`);
      }
    }
  );

  const onSubmit = (data: DealFormData) => {
    createDeal.mutate(data);
  };

  if (carriersLoading || productsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Post a Deal</h1>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div>
            <label htmlFor="carrier_id" className="block text-sm font-medium text-gray-700">
              Carrier
            </label>
            <select
              {...register('carrier_id', { required: 'Carrier is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="">Select a Carrier</option>
              {carriers?.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </select>
            {errors.carrier_id && (
              <p className="mt-1 text-sm text-red-600">{errors.carrier_id.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="product_id" className="block text-sm font-medium text-gray-700">
              Product
            </label>
            <select
              {...register('product_id', { required: 'Product is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              disabled={!selectedCarrierId}
            >
              <option value="">Select a Product</option>
              {products?.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            {errors.product_id && (
              <p className="mt-1 text-sm text-red-600">{errors.product_id.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="effective_date" className="block text-sm font-medium text-gray-700">
              Policy Effective / Draft Date
            </label>
            <input
              type="date"
              {...register('effective_date', { required: 'Effective date is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
            {errors.effective_date && (
              <p className="mt-1 text-sm text-red-600">{errors.effective_date.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="monthly_premium" className="block text-sm font-medium text-gray-700">
              Monthly Premium
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                {...register('monthly_premium', { 
                  required: 'Monthly premium is required',
                  min: { value: 0, message: 'Monthly premium must be positive' }
                })}
                className="mt-1 block w-full pl-7 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            {errors.monthly_premium && (
              <p className="mt-1 text-sm text-red-600">{errors.monthly_premium.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="annual_premium" className="block text-sm font-medium text-gray-700">
              Annual Premium
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                {...register('annual_premium', { 
                  required: 'Annual premium is required',
                  min: { value: 0, message: 'Annual premium must be positive' }
                })}
                className="mt-1 block w-full pl-7 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            {errors.annual_premium && (
              <p className="mt-1 text-sm text-red-600">{errors.annual_premium.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="client_name" className="block text-sm font-medium text-gray-700">
              Client Name
            </label>
            <input
              type="text"
              {...register('client_name', { required: 'Client name is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
            {errors.client_name && (
              <p className="mt-1 text-sm text-red-600">{errors.client_name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="client_phone" className="block text-sm font-medium text-gray-700">
              Client Phone Number
            </label>
            <input
              type="tel"
              {...register('client_phone')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="policy_number" className="block text-sm font-medium text-gray-700">
              Policy Number
            </label>
            <input
              type="text"
              {...register('policy_number')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="app_number" className="block text-sm font-medium text-gray-700">
              Application Number
            </label>
            <input
              type="text"
              {...register('app_number')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="split_agent_id" className="block text-sm font-medium text-gray-700">
              Split Commission with another Agent
            </label>
            <select
              {...register('split_agent_id')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="">No Split</option>
              {/* Add agent options here */}
            </select>
          </div>

          <div>
            <label htmlFor="split_percentage" className="block text-sm font-medium text-gray-700">
              Split Percentage
            </label>
            <input
              type="number"
              {...register('split_percentage')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              placeholder="50"
              min="0"
              max="100"
              step="1"
            />
          </div>

          <div>
            <label htmlFor="referral_count" className="block text-sm font-medium text-gray-700">
              Number of Referrals Collected
            </label>
            <input
              type="number"
              {...register('referral_count')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              min="0"
              defaultValue={0}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="radio"
                {...register('lead_source')}
                value="referral"
                id="lead_source_referral"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <label htmlFor="lead_source_referral" className="ml-3 block text-sm font-medium text-gray-700">
                This deal is a referral from a lead
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                {...register('lead_source')}
                value="free_lead"
                id="lead_source_free"
                defaultChecked
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <label htmlFor="lead_source_free" className="ml-3 block text-sm font-medium text-gray-700">
                This deal is a free lead provided by American Coverage Center
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                {...register('lead_source')}
                value="self_generated"
                id="lead_source_self"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <label htmlFor="lead_source_self" className="ml-3 block text-sm font-medium text-gray-700">
                This deal is a purchased or self-generated lead
              </label>
            </div>
          </div>

          <div className="pt-5">
            <button
              type="submit"
              disabled={createDeal.isLoading}
              className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {createDeal.isLoading ? 'Submitting...' : 'Submit Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostDeal;