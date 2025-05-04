 import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Settings, Position, Product, Carrier, CommissionSplit } from '../../types/database';
import { supabase } from '../../lib/supabase';
import { Loader2, Plus, ChevronDown, ChevronRight, Settings as SettingsIcon, Edit2, Trash2 } from 'lucide-react';
import { Dialog, Transition, Disclosure } from '@headlessui/react';
import { Fragment } from 'react';
import toast from 'react-hot-toast';

const CarriersAndProducts = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [carrierToDelete, setCarrierToDelete] = useState<Carrier | null>(null);
  const [modalType, setModalType] = useState<'carrier' | 'product' | 'splits' | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: carriers, isLoading: carriersLoading } = useQuery<Carrier[]>('carriers', async () => {
    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>(
    ['products', selectedCarrier],
    async () => {
      const query = supabase
        .from('products')
        .select('*, carriers(name)');
      
      if (selectedCarrier) {
        query.eq('carrier_id', selectedCarrier);
      }
      
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data;
    }
  );

  const { data: positions } = useQuery<Position[]>('positions', async () => {
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .order('level');
    if (error) throw error;
    return data;
  });

  const { data: commissionSplits, isLoading: splitsLoading } = useQuery<CommissionSplit[]>(
    ['commission_splits', selectedProduct?.id],
    async () => {
      if (!selectedProduct) return [];
      
      const { data, error } = await supabase
        .from('commission_splits')
        .select(`
          *,
          positions(name, level),
          products(name, carrier_id)
        `)
        .eq('product_id', selectedProduct.id);
      
      if (error) throw error;
      return data;
    },
    {
      enabled: !!selectedProduct,
    }
  );

  const deleteCarrier = useMutation(
    async (carrier: Carrier) => {
      // First, get all products for this carrier
      const { data: carrierProducts, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('carrier_id', carrier.id);

      if (productsError) {
        throw new Error('Failed to fetch carrier products');
      }

      const productIds = carrierProducts.map(p => p.id);

      // Delete commission splits for all products
      if (productIds.length > 0) {
        const { error: splitsError } = await supabase
          .from('commission_splits')
          .delete()
          .in('product_id', productIds);

        if (splitsError) {
          throw new Error('Failed to delete commission splits');
        }
      }

      // Delete products
      const { error: productsDeleteError } = await supabase
        .from('products')
        .delete()
        .eq('carrier_id', carrier.id);

      if (productsDeleteError) {
        throw new Error('Failed to delete products');
      }

      // Finally delete the carrier
      const { error: carrierError } = await supabase
        .from('carriers')
        .delete()
        .eq('id', carrier.id);

      if (carrierError) {
        throw new Error('Failed to delete carrier');
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('carriers');
        queryClient.invalidateQueries('products');
        queryClient.invalidateQueries('commission_splits');
        setIsDeleteModalOpen(false);
        setCarrierToDelete(null);
        toast.success('Carrier and associated data deleted successfully');
      },
      onError: (error: any) => {
        toast.error(`Error: ${error.message}`);
        console.error('Error deleting carrier:', error);
      }
    }
  );

  const addCarrier = useMutation(
    async (newCarrier: Partial<Carrier>) => {
      const { data, error } = await supabase
        .from('carriers')
        .insert([newCarrier])
        .select();
      if (error) throw error;
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('carriers');
        setIsModalOpen(false);
        toast.success('Carrier added successfully');
      }
    }
  );

  const addProduct = useMutation(
    async (newProduct: Partial<Product>) => {
      const { data, error } = await supabase
        .from('products')
        .insert([newProduct])
        .select();
      if (error) throw error;
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('products');
        setIsModalOpen(false);
        toast.success('Product added successfully');
      }
    }
  );

  const updateCommissionSplit = useMutation(
    async ({ id, percentage }: { id: string; percentage: number }) => {
      const { data, error } = await supabase
        .from('commission_splits')
        .update({ percentage })
        .eq('id', id)
        .select();
      if (error) throw error;
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('commission_splits');
        toast.success('Commission split updated successfully');
      }
    }
  );

  const handleAddItem = (type: 'carrier' | 'product' | 'splits', product?: Product) => {
    setModalType(type);
    if (product) {
      setSelectedProduct(product);
    }
    setIsModalOpen(true);
  };

  const handleSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());

    try {
      switch (modalType) {
        case 'carrier':
          await addCarrier.mutateAsync(data);
          break;
        case 'product':
          await addProduct.mutateAsync({ ...data, carrier_id: selectedCarrier });
          break;
      }
    } catch (error) {
      console.error('Error submitting item:', error);
    }
  };

  const handleDeleteCarrier = (e: React.MouseEvent, carrier: Carrier) => {
    e.stopPropagation();
    setCarrierToDelete(carrier);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (carrierToDelete) {
      deleteCarrier.mutate(carrierToDelete);
    }
  };

  if (carriersLoading || productsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Carriers & Products</h1>
          <div className="flex space-x-4">
            <button
              onClick={() => handleAddItem('carrier')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Carrier
            </button>
          </div>
        </div>

        <div className="mt-6">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            {carriers?.map((carrier) => (
              <Disclosure key={carrier.id}>
                {({ open }) => (
                  <>
                    <Disclosure.Button
                      className="w-full px-4 py-4 text-left flex items-center justify-between hover:bg-gray-50"
                    >
                      <div className="flex items-center">
                        {open ? (
                          <ChevronDown className="h-5 w-5 text-gray-400 mr-2" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400 mr-2" />
                        )}
                        <span className="font-medium text-gray-900">{carrier.name}</span>
                        <span className="ml-3 text-sm text-gray-500">
                          Advance Rate: {carrier.advance_rate || 75}%
                        </span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-500">
                          {products?.filter(p => p.carrier_id === carrier.id).length || 0} Products
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCarrier(carrier.id);
                            handleAddItem('product');
                          }}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-primary-600 hover:text-primary-700 focus:outline-none"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Product
                        </button>
                        <button
                          onClick={(e) => handleDeleteCarrier(e, carrier)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-600 hover:text-red-700 focus:outline-none"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </Disclosure.Button>

                    <Disclosure.Panel>
                      <div className="px-4 py-4 border-t border-gray-200">
                        <div className="mb-4 bg-gray-50 p-3 rounded-md">
                          <div className="flex flex-wrap gap-4">
                            <div>
                              <span className="text-sm font-medium text-gray-500">Advance Rate:</span>
                              <span className="ml-2 text-sm text-gray-900">{carrier.advance_rate || 75}%</span>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-500">Advance Period:</span>
                              <span className="ml-2 text-sm text-gray-900">{carrier.advance_period_months || 9} months</span>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-500">Payment Type:</span>
                              <span className="ml-2 text-sm text-gray-900">{carrier.payment_type || 'advance'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {products
                            ?.filter(product => product.carrier_id === carrier.id)
                            .map(product => (
                              <div key={product.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                                <div>
                                  <h3 className="text-lg font-medium text-gray-900">{product.name}</h3>
                                </div>
                                <div className="flex items-center space-x-4">
                                  <button
                                    onClick={() => handleAddItem('splits', product)}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                  >
                                    <SettingsIcon className="h-4 w-4 mr-2" />
                                    Rate Adjustments
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </Disclosure.Panel>
                  </>
                )}
              </Disclosure>
            ))}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <Transition appear show={isDeleteModalOpen} as={Fragment}>
          <Dialog
            as="div"
            className="fixed inset-0 z-10 overflow-y-auto"
            onClose={() => setIsDeleteModalOpen(false)}
          >
            <div className="min-h-screen px-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
              </Transition.Child>

              <span className="inline-block h-screen align-middle" aria-hidden="true">
                &#8203;
              </span>

              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
                  <Dialog.Title className="text-lg font-medium text-gray-900">
                    Delete Carrier
                  </Dialog.Title>

                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete {carrierToDelete?.name}? This will also delete all associated products and commission splits and cannot be undone.
                    </p>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsDeleteModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmDelete}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>

        {/* Commission Splits Modal */}
        <Transition appear show={isModalOpen && modalType === 'splits'} as={Fragment}>
          <Dialog
            as="div"
            className="fixed inset-0 z-10 overflow-y-auto"
            onClose={() => setIsModalOpen(false)}
          >
            <div className="min-h-screen px-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
              </Transition.Child>

              <span className="inline-block h-screen align-middle" aria-hidden="true">
                &#8203;
              </span>

              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <div className="inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
                  <Dialog.Title className="text-lg font-medium text-gray-900 mb-6">
                    Commission Rate Adjustments - {selectedProduct?.name}
                  </Dialog.Title>

                  <div className="mt-4">
                    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Position
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Commission Rate
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {positions?.map((position) => {
                            const split = commissionSplits?.find(s => (s.positions as any).id === position.id);
                            return (
                              <tr key={position.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {position.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <div className="flex items-center justify-end space-x-2">
                                    <input
                                      type="number"
                                      value={split?.percentage || 0}
                                      onChange={(e) => split && updateCommissionSplit.mutate({
                                        id: split.id,
                                        percentage: Number(e.target.value)
                                      })}
                                      className="w-20 text-right border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                    />
                                    <span className="text-sm text-gray-500">%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>

        {/* Add Carrier Modal */}
        <Transition appear show={isModalOpen && modalType === 'carrier'} as={Fragment}>
          <Dialog
            as="div"
            className="fixed inset-0 z-10 overflow-y-auto"
            onClose={() => setIsModalOpen(false)}
          >
            <div className="min-h-screen px-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
              </Transition.Child>

              <span className="inline-block h-screen align-middle" aria-hidden="true">
                &#8203;
              </span>

              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
                  <Dialog.Title className="text-lg font-medium text-gray-900">
                    Add New Carrier
                  </Dialog.Title>

                  <form onSubmit={handleSubmitItem} className="mt-4">
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                          Carrier Name
                        </label>
                        <input
                          type="text"
                          name="name"
                          id="name"
                          required
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="advance_rate" className="block text-sm font-medium text-gray-700">
                          Advance Rate (%)
                        </label>
                        <input
                          type="number"
                          name="advance_rate"
                          id="advance_rate"
                          required
                          min="0"
                          max="100"
                          step="0.01"
                          defaultValue="75"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="advance_period_months" className="block text-sm font-medium text-gray-700">
                          Advance Period (months)
                        </label>
                        <input
                          type="number"
                          name="advance_period_months"
                          id="advance_period_months"
                          required
                          min="1"
                          max="24"
                          step="1"
                          defaultValue="9"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="payment_type" className="block text-sm font-medium text-gray-700">
                          Payment Type
                        </label>
                        <select
                          name="payment_type"
                          id="payment_type"
                          required
                          defaultValue="advance"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        >
                          <option value="advance">Advance</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        Add Carrier
                      </button>
                    </div>
                  </form>
                </div>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>

        {/* Add Product Modal */}
        <Transition appear show={isModalOpen && modalType === 'product'} as={Fragment}>
          <Dialog
            as="div"
            className="fixed inset-0 z-10 overflow-y-auto"
            onClose={() => setIsModalOpen(false)}
          >
            <div className="min-h-screen px-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
              </Transition.Child>

              <span className="inline-block h-screen align-middle" aria-hidden="true">
                &#8203;
              </span>

              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
                  <Dialog.Title className="text-lg font-medium text-gray-900">
                    Add New Product
                  </Dialog.Title>

                  <form onSubmit={handleSubmitItem} className="mt-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Product Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        required
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        Add Product
                      </button>
                    </div>
                  </form>
                </div>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>
      </div>
    </div>
  );
};

export default CarriersAndProducts;