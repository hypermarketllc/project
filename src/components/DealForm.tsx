import React from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { supabase } from '../lib/supabase';
import { Carrier, Product, Deal } from '../types/database';
import toast from 'react-hot-toast';

type DealFormData = {
  carrier_id: string;
  product_id: string;
  client_name: string;
  client_dob: string;
  client_phone: string;
  client_email: string;
  face_amount: number;
  monthly_premium: number;
  annual_premium: number;
  policy_number: string;
  notes: string;
};

const DealForm = () => {
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<DealFormData>();

  const { data: carriers } = useQuery<Carrier[]>('carriers', async () => {
    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data;
  });

  const selectedCarrierId = watch('carrier_id');

  const { data: products } = useQuery<Product[]>(
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

  const createDeal = useMutation<Deal, Error, DealFormData>(
    async (data) => {
      const { data: newDeal, error } = await supabase
        .from('deals')
        .insert([{
          ...data,
          agent_id: (await supabase.auth.getUser()).data.user?.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return newDeal;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('deals');
        toast.success('Deal created successfully');
        reset();
      },
      onError: (error) => {
        toast.error(`Error creating deal: ${error.message}`);
        console.error('Error creating deal:', error);
      }
    }
  );

  const onSubmit = (data: DealFormData) => {
    createDeal.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="md:grid md:grid-cols-3 md:gap-6">
          <div className="md:col-span-1">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Deal Information</h3>
            <p className="mt-1 text-sm text-gray-500">
              Enter the details of the new insurance deal.
            </p>
          </div>
          
          <div className="mt-5 md:mt-0 md:col-span-2">
            <div className="grid grid-cols-6 gap-6">
              <div className="col-span-6 sm:col-span-3">
                <label htmlFor="carrier_id" className="block text-sm font-medium text-gray-700">
                  Carrier
                </label>
                <select
                  {...register('carrier_id', { required: true })}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  <option value="">Select a carrier</option>
                  {carriers?.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </option>
                  ))}
                </select>
                {errors.carrier_id && (
                  <p className="mt-1 text-sm text-red-600">Carrier is required</p>
                )}
              </div>

              <div className="col-span-6 sm:col-span-3">
                <label htmlFor="product_id" className="block text-sm font-medium text-gray-700">
                  Product
                </label>
                <select
                  {...register('product_id', { required: true })}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  <option value="">Select a product</option>
                  {products?.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                {errors.product_id && (
                  <p className="mt-1 text-sm text-red-600">Product is required</p>
                )}
              </div>

              <div className="col-span-6 sm:col-span-4">
                <label htmlFor="client_name" className="block text-sm font-medium text-gray-700">
                  Client Name
                </label>
                <input
                  type="text"
                  {...register('client_name', { required: true })}
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
                {errors.client_name && (
                  <p className="mt-1 text-sm text-red-600">Client name is required</p>
                )}
              </div>

              <div className="col-span-6 sm:col-span-3">
                <label htmlFor="client_dob" className="block text-sm font-medium text-gray-700">
                  Date of Birth
                </label>
                <input
                  type="date"
                  {...register('client_dob')}
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>

              <div className="col-span-6 sm:col-span-3">
                <label htmlFor="client_phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  {...register('client_phone')}
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>

              <div className="col-span-6 sm:col-span-4">
                <label htmlFor="client_email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  {...register('client_email')}
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>

              <div className="col-span-6 sm:col-span-3">
                <label htmlFor="face_amount" className="block text-sm font-medium text-gray-700">
                  Face Amount
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    {...register('face_amount', { min: 0 })}
                    className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="col-span-6 sm:col-span-3">
                <label htmlFor="monthly_premium" className="block text-sm font-medium text-gray-700">
                  Monthly Premium
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    {...register('monthly_premium', { required: true, min: 0 })}
                    className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                    placeholder="0.00"
                  />
                </div>
                {errors.monthly_premium && (
                  <p className="mt-1 text-sm text-red-600">Monthly premium is required</p>
                )}
              </div>

              <div className="col-span-6 sm:col-span-3">
                <label htmlFor="annual_premium" className="block text-sm font-medium text-gray-700">
                  Annual Premium
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    {...register('annual_premium', { required: true, min: 0 })}
                    className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                    placeholder="0.00"
                  />
                </div>
                {errors.annual_premium && (
                  <p className="mt-1 text-sm text-red-600">Annual premium is required</p>
                )}
              </div>

              <div className="col-span-6 sm:col-span-4">
                <label htmlFor="policy_number" className="block text-sm font-medium text-gray-700">
                  Policy Number
                </label>
                <input
                  type="text"
                  {...register('policy_number')}
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>

              <div className="col-span-6">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  {...register('notes')}
                  rows={3}
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => reset()}
          className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createDeal.isLoading}
          className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          {createDeal.isLoading ? 'Submitting...' : 'Submit Deal'}
        </button>
      </div>
    </form>
  );
};

export default DealForm;