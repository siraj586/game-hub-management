import SettingsModal from '../components/SettingsModal';
import { useApp } from '../context/AppContext';

const SettingsPage = () => {
  const { t } = useApp();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black dark:text-white text-gray-800 flex items-center gap-2">
          <i className="fas fa-cog text-indigo-500" />
          {t('settings')}
        </h2>
        <p className="text-sm dark:text-gray-500 text-gray-400 mt-1">
          {t('settings_subtitle')}
        </p>
      </div>
      <SettingsModal embedded />
    </div>
  );
};

export default SettingsPage;
