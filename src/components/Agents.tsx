import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { supabase } from '../lib/supabase';
import { Agent, Position, PermissionLevel } from '../types/database';
import { Loader2, Plus, Edit2, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import toast from 'react-hot-toast';

const Agents = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [sendInvite, setSendInvite] = useState(true);

  // Fetch all data in parallel with proper error handling
  const { data: agents, isLoading: agentsLoading, error: agentsError } = useQuery<Agent[]>(
    'agents',
    async () => {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          positions (
            id,
            name,
            level
          ),
          downline:upline_id (
            id,
            full_name
          )
        `)
        .order('full_name');
      
      if (error) throw error;
      return data;
    }
  );

  const { data: positions } = useQuery<Position[]>(
    'positions',
    async () => {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .order('level');
      if (error) throw error;
      return data;
    }
  );

  const updateAgent = useMutation(
    async (agent: Partial<Agent>) => {
      const { data, error } = await supabase
        .rpc('update_user_details', {
          p_user_id: agent.id,
          p_full_name: agent.full_name,
          p_email: agent.email,
          p_phone: agent.phone,
          p_position_id: agent.position_id,
          p_upline_id: agent.upline_id,
          p_national_producer_number: agent.national_producer_number,
          p_annual_goal: agent.annual_goal,
          p_is_active: agent.is_active
        });

      if (error) throw error;
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('agents');
        setIsModalOpen(false);
        setEditingAgent(null);
        toast.success('Agent updated successfully');
      },
      onError: (error: any) => {
        toast.error(`Failed to update agent: ${error.message}`);
      }
    }
  );

  const deleteAgent = useMutation(
    async (agentId: string) => {
      const { error } = await supabase
        .rpc('delete_user_cascade', {
          target_user_id: agentId
        });

      if (error) throw error;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('agents');
        setIsDeleteModalOpen(false);
        setAgentToDelete(null);
        toast.success('Agent deleted successfully');
      },
      onError: (error: any) => {
        toast.error(`Failed to delete agent: ${error.message}`);
      }
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    const firstName = formData.get('first_name') as string;
    const lastName = formData.get('last_name') as string;
    const fullName = `${firstName} ${lastName}`.trim();
    
    const data: Record<string, any> = {
      id: editingAgent?.id,
      full_name: fullName,
      email: formData.get('email'),
      phone: formData.get('phone'),
      position_id: formData.get('position_id') || null,
      upline_id: formData.get('upline_id') || null,
      national_producer_number: formData.get('national_producer_number'),
      annual_goal: formData.get('annual_goal') ? parseFloat(formData.get('annual_goal') as string) : null,
      is_active: true
    };

    try {
      await updateAgent.mutateAsync(data);
    } catch (error) {
      console.error('Error submitting agent:', error);
    }
  };

  const handleDeleteClick = (agent: Agent) => {
    setAgentToDelete(agent);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (agentToDelete) {
      deleteAgent.mutate(agentToDelete.id);
    }
  };

  if (agentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (agentsError) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-600 mb-4">Failed to load agents</p>
        <button
          onClick={() => queryClient.invalidateQueries('agents')}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Agents</h1>
            <p className="mt-2 text-sm text-gray-700">
              A list of all agents in your organization including their name, position, and contact information.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              onClick={() => {
                setEditingAgent(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Agent
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-col">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Name
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Email
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Phone
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Position
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Downline
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        NPN
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Annual Goal
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {agents?.map((agent) => (
                      <tr key={agent.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {agent.full_name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{agent.email}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {agent.phone || 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {(agent.positions as Position)?.name || 'No Position'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {(agent.downline as Agent)?.full_name || 'No Downline'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {agent.national_producer_number || 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {agent.annual_goal ? `$${agent.annual_goal.toLocaleString()}` : 'N/A'}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => {
                                setEditingAgent(agent);
                                setIsModalOpen(true);
                              }}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              <Edit2 className="h-4 w-4" />
                              <span className="sr-only">Edit {agent.full_name}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteClick(agent)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete {agent.full_name}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
                    Delete Agent
                  </Dialog.Title>

                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete {agentToDelete?.full_name}? This action cannot be undone and will also delete:
                    </p>
                    <ul className="mt-2 text-sm text-gray-500 list-disc list-inside">
                      <li>All deals associated with this agent</li>
                      <li>All commission records</li>
                      <li>User account settings</li>
                      <li>Authentication credentials</li>
                    </ul>
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
                      Delete Agent
                    </button>
                  </div>
                </div>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>

        {/* Edit/Add Agent Modal */}
        <Transition appear show={isModalOpen} as={Fragment}>
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
                    {editingAgent ? 'Edit Agent' : 'Add New Agent'}
                  </Dialog.Title>

                  <form onSubmit={handleSubmit} className="mt-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                            First Name
                          </label>
                          <input
                            type="text"
                            name="first_name"
                            id="first_name"
                            required
                            defaultValue={editingAgent?.full_name.split(' ')[0]}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                            Last Name
                          </label>
                          <input
                            type="text"
                            name="last_name"
                            id="last_name"
                            required
                            defaultValue={editingAgent?.full_name.split(' ').slice(1).join(' ')}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          Email
                        </label>
                        <input
                          type="email"
                          name="email"
                          id="email"
                          required
                          defaultValue={editingAgent?.email}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          id="phone"
                          defaultValue={editingAgent?.phone}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="position_id" className="block text-sm font-medium text-gray-700">
                          Position
                        </label>
                        <select
                          name="position_id"
                          id="position_id"
                          defaultValue={editingAgent?.position_id || ''}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        >
                          <option value="">Select Position</option>
                          {positions?.map((position) => (
                            <option key={position.id} value={position.id}>
                              {position.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="upline_id" className="block text-sm font-medium text-gray-700">
                          Downline
                        </label>
                        <select
                          name="upline_id"
                          id="upline_id"
                          defaultValue={editingAgent?.upline_id || ''}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        >
                          <option value="">No Downline</option>
                          {agents
                            ?.filter(a => a.id !== editingAgent?.id)
                            .map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.full_name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="national_producer_number" className="block text-sm font-medium text-gray-700">
                          National Producer Number
                        </label>
                        <input
                          type="text"
                          name="national_producer_number"
                          id="national_producer_number"
                          defaultValue={editingAgent?.national_producer_number}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="annual_goal" className="block text-sm font-medium text-gray-700">
                          Annual Goal
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            name="annual_goal"
                            id="annual_goal"
                            defaultValue={editingAgent?.annual_goal}
                            className="mt-1 block w-full pl-7 rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          setEditingAgent(null);
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        {editingAgent ? 'Update' : 'Add'} Agent
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

export default Agents;