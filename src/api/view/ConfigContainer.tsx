import React from 'react';
import TranslateIcon from '@mui/icons-material/Translate';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import PaletteIcon from '@mui/icons-material/Palette';
import { Star } from 'lucide-react';
import { ApiConfig, Config, GalleryConfig, isGalleryConfig } from '../../service/ApiFactory';
import GalleryConfigExecutor from './gallery/GallerConfigExecutor';

interface ConfigContainerProps {
    configs: Config[];
    clickedConfig: Config | null;
    selectedConfigs: number[];
    handleItemClick: (config: Config, event: React.MouseEvent) => void;
    handleExecute?: (config: GalleryConfig) => void;
}

const ConfigContainer: React.FC<ConfigContainerProps> = ({ configs, clickedConfig, selectedConfigs, handleItemClick, handleExecute }) => {
    const handleWebsiteClick = (url: string, event: React.MouseEvent) => {
        event.stopPropagation();
        window.open(url, "_blank");
    };

    return (
        <div className="configs-container col-span-2">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
            {configs.map(config => (
              <div key={config.id} className={`config-item ${clickedConfig && clickedConfig.id === config.id ? 'selected-config ' : '' } ${selectedConfigs.includes(config.id)? 'active-config ':''}`} onClick={(e) => handleItemClick(config, e)}>
                <div  className="flex justify-between">
                  <label className="flex gap-2">
                  <p>
                   {config.category && (
                      (() => {
                        switch (config.category.toLowerCase()) {
                          case 'mtg':
                            return <img src='/icons/mtg.png' alt="MTG Icon" className="categoryIcon" />;
                          case 'poke':
                            return <img src='/icons/poke.png' alt="Pokemon Icon" className="categoryIcon" />;
                          case 'yugioh':
                            return <img src='/icons/yugi.webp' alt="Yugi Icon" className="categoryIcon" />;
                          case 'misc':
                            return <img src='/icons/misc.webp' alt="Misc Icon" className="categoryIcon" />;
                          default:
                            return null;
                        }
                      })()
                    )}
                    {(config as ApiConfig).languageField || (config as ApiConfig).nestedLanguageLanguageField?<span><TranslateIcon className="subCategoryIcon"/></span>:<span></span>}
                    {config.customArts?<span><PaletteIcon className="subCategoryIcon"/></span>:<span></span>}
                    {config.published?<span><PublicIcon className="subCategoryIcon"/></span>:<span><LockIcon className="subCategoryIcon"/></span>}
                    </p>

                  </label>
                  <div>
                    {config.hasOwnProperty('ratingCount') && (
                    <div className="rating">
                        {[1, 2, 3, 4, 5].map(score => (
                        <Star
                            key={score}
                            strokeWidth={` ${score <= (config.ratingValue || 0) ? '0' : '0.3' }`}
                            fill={` ${score <= (config.ratingValue || 0) ? '#3273a8' : 'none' }`}
                            // className={`cursor-pointer ${score <= config.ratingValue
                            //     ? 'text-light-blue-400 fill-light-blue-400'
                            //     : 'text-gray-300'
                            //   }`}
                        />
                        ))}
                        <span className="text-sm text-gray-600">
                            {config.averageRating} ({config.ratingCount})
                        </span>
                    </div>
                    )}
                    <p>
                      {config.officialWebsite?<span onClick={(e) => handleWebsiteClick(config.officialWebsite!, e)}>{config.name}<ExitToAppIcon className='inline-icon'/></span>:<span>{config.name}</span>}
                    </p>
                    {isGalleryConfig(config) && config===clickedConfig && handleExecute && (<GalleryConfigExecutor config={config} handleExecute={handleExecute}/>)}
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>
    );
}
export default ConfigContainer;
