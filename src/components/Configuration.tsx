import React, { useState } from 'react';
import { Tab } from '@headlessui/react';
import { Settings as SettingsIcon, Users, Link, Box } from 'lucide-react';
import CarriersAndProducts from './configuration/CarriersAndProducts';
import Positions from './configuration/Positions';
import Integrations from './configuration/Integrations';
import Settings from './configuration/Settings';
import clsx from 'clsx';

const Configuration = () => {
  const tabs = [
    { name: 'Carriers & Products', icon: Box, component: CarriersAndProducts },
    { name: 'Positions', icon: Users, component: Positions },
    { name: 'Integrations', icon: Link, component: Integrations },
    { name: 'Settings', icon: SettingsIcon, component: Settings },
  ];

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-xl bg-primary-900/20 p-1">
            {tabs.map((tab) => (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  clsx(
                    'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                    'ring-white ring-opacity-60 ring-offset-2 ring-offset-primary-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-white text-primary-700 shadow'
                      : 'text-gray-600 hover:bg-white/[0.12] hover:text-primary-600'
                  )
                }
              >
                <div className="flex items-center justify-center">
                  <tab.icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </div>
              </Tab>
            ))}
          </Tab.List>
          <Tab.Panels className="mt-2">
            {tabs.map((tab, idx) => (
              <Tab.Panel
                key={idx}
                className={clsx(
                  'rounded-xl bg-white p-3',
                  'ring-white ring-opacity-60 ring-offset-2 ring-offset-primary-400 focus:outline-none focus:ring-2'
                )}
              >
                <tab.component />
              </Tab.Panel>
            ))}
          </Tab.Panels>
        </Tab.Group>
      </div>
    </div>
  );
};

export default Configuration;