import SettingsModal from '../components/SettingsModal';

const SettingsPage = () => (
  <div className="space-y-4">
    <div>
      <h2 className="text-2xl font-black dark:text-white text-gray-800 flex items-center gap-2">
        <i className="fas fa-cog text-indigo-500" />
        Settings
      </h2>
      <p className="text-sm dark:text-gray-500 text-gray-400 mt-1">
        Manage center setup, staff, permissions, expenses, and devices.
      </p>
    </div>
    <SettingsModal embedded />
  </div>
);

export default SettingsPage;
