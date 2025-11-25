/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import {useState} from 'react';
import {SavedShot} from '../types';
import {FilmIcon, PencilIcon, Trash2Icon, XMarkIcon} from './icons';

interface ShotLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  shots: SavedShot[];
  onLoadShot: (shot: SavedShot) => void;
  onDeleteShot: (shotId: string) => void;
  onUpdateShotTitle: (shotId: string, newTitle: string) => void;
}

const ShotLibrary: React.FC<ShotLibraryProps> = ({
  isOpen,
  onClose,
  shots,
  onLoadShot,
  onDeleteShot,
  onUpdateShotTitle,
}) => {
  const [editingState, setEditingState] = useState<{
    id: string;
    currentTitle: string;
  } | null>(null);

  if (!isOpen) return null;

  const sortedShots = [...shots].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const handleSaveTitle = () => {
    if (editingState) {
      onUpdateShotTitle(editingState.id, editingState.currentTitle);
      setEditingState(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setEditingState(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <FilmIcon className="w-6 h-6 text-indigo-400" />
            Shot Library
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-grow p-6 overflow-y-auto">
          {sortedShots.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center text-gray-500">
              <div>
                <h3 className="text-2xl">Your Library is Empty</h3>
                <p>
                  Generate a video and use the "Save Shot" button to add it
                  here.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedShots.map((shot) => (
                <div
                  key={shot.id}
                  className="bg-gray-900/50 rounded-lg overflow-hidden flex flex-col group border border-transparent hover:border-indigo-500 transition-colors">
                  <div className="aspect-video bg-black relative">
                    <img
                      src={`data:image/png;base64,${shot.thumbnail}`}
                      alt="Shot thumbnail"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onDeleteShot(shot.id)}
                        className="p-2 bg-red-800/80 hover:bg-red-700 text-white rounded-full transition-colors"
                        title="Delete Shot">
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 flex-grow flex flex-col justify-between">
                    <div>
                      {editingState?.id === shot.id ? (
                        <div className="mb-2">
                          <input
                            type="text"
                            value={editingState.currentTitle}
                            onChange={(e) =>
                              setEditingState({
                                ...editingState,
                                currentTitle: e.target.value,
                              })
                            }
                            onBlur={handleSaveTitle}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="w-full bg-gray-700 text-white p-1 rounded-md text-sm border border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Press Enter to save, Esc to cancel
                          </p>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h4 className="text-base font-semibold text-white line-clamp-2 break-words flex-grow">
                            {shot.title || 'Untitled Shot'}
                          </h4>
                          <button
                            onClick={() =>
                              setEditingState({
                                id: shot.id,
                                currentTitle: shot.title || '',
                              })
                            }
                            className="p-1 text-gray-400 hover:text-white flex-shrink-0"
                            title="Rename shot">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <div className="text-xs text-gray-400 mb-2 bg-gray-800 p-2 rounded-md max-h-24 overflow-y-auto">
                        <pre className="whitespace-pre-wrap break-all">
                          {shot.prompt}
                        </pre>
                      </div>

                      <p className="text-xs text-gray-500">
                        {new Date(shot.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => onLoadShot(shot)}
                      className="w-full mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-sm">
                      Load Shot
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ShotLibrary;