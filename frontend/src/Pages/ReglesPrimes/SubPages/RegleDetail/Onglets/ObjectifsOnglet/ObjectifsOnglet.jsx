/*
 * Fichier : ObjectifsOnglet.jsx
 * Rôle    : Onglet "Objectifs" du détail d'une règle de prime.
 *           Affiche les KPIs de configuration et la description.
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / Onglets
 */

import React, { useState, useMemo } from 'react';
import './ObjectifsOnglet.css';
import KpiGridSection from './Sections/KpiGridSection/KpiGridSection';
import DescriptionSection from './Sections/DescriptionSection/DescriptionSection';
import ToolbarSection from './Sections/ToolbarSection/ToolbarSection';
import GrilleSection from './Sections/GrilleSection/GrilleSection';
import GrilleEditorModal from './Components/GrilleEditorModal/GrilleEditorModal';
import SaveVersionModal from './Components/SaveVersionModal/SaveVersionModal';
import ConfirmationModal from '../../../../../../Components/ConfirmationModal/ConfirmationModal';
import { useSocket } from '../../../../../../Shared/Contexts/SocketContext';
import { useToast } from '../../../../../../Shared/Contexts/ToastContext';
import useApiSWR from '../../../../../../Shared/Hooks/useApiSWR';
import { fetchRegleConfigs } from '../../../../../../Shared/Utils/apiFetchers';
import { clearCacheKey, TTL } from '../../../../../../Shared/Utils/cacheStorage';

export default function ObjectifsOnglet({ regle }) {
  const addToast = useToast();
  const socket = useSocket();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isNewMode, setIsNewMode] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [pendingGrille, setPendingGrille] = useState(null);
  const [pendingGrilleUuid, setPendingGrilleUuid] = useState(null);
  const [selectedVersions, setSelectedVersions] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const configsCacheKey = regle?.id ? `regle:${regle.id}:configs` : null;

  const { data: configs = [], loading: loadingConfigs, revalidate: revalidateConfigs } = useApiSWR(
    configsCacheKey,
    () => fetchRegleConfigs(regle.id),
    { ttl: TTL.HEAVY }
  );

  // Synchronise selectedVersions quand configs change
  useMemo(() => {
    if (!configs?.length) return;
    const initialSelected = {};
    const grillesMap = {};
    configs.forEach(c => {
      const uuid = c.grille_uuid || 'default';
      if (!grillesMap[uuid]) grillesMap[uuid] = [];
      grillesMap[uuid].push(c);
    });
    Object.entries(grillesMap).forEach(([uuid, versions]) => {
      const active = versions.find(v => v.est_active);
      initialSelected[uuid] = active ? active.id : versions[0].id;
    });
    setSelectedVersions(initialSelected);
  }, [configs]);

  // Invalidate + revalidate helper
  const refreshConfigs = () => {
    clearCacheKey(configsCacheKey);
    revalidateConfigs();
  };

  // Real-time updates
  useState(() => {
    if (!socket || !regle?.id) return;
    const handleUpdate = (data) => {
      if (data && data.regle_id && String(data.regle_id) !== String(regle.id)) return;
      refreshConfigs();
    };
    socket.on('regle_configs_updated', handleUpdate);
    return () => socket.off('regle_configs_updated', handleUpdate);
  });

  if (!regle) return null;

  const handleSaveGrille = (newGrille, grilleUuid = null) => {
    setPendingGrille(newGrille);
    setPendingGrilleUuid(grilleUuid);
    setIsSaveModalOpen(true);
  };

  const handleConfirmSaveVersion = async (libelle, newGrilleNom) => {
    // Si pendingGrilleUuid est présent, c'est une nouvelle version d'une grille existante
    // Sinon, si isNewMode est vrai, c'est une toute nouvelle grille
    const activeForUuid = configs.find(c => c.id === selectedVersions[pendingGrilleUuid]);
    
    const grilleUuid = pendingGrilleUuid || (isNewMode ? `grille_${Date.now()}` : 'default');
    const grilleNom = isNewMode ? newGrilleNom : (activeForUuid?.grille_nom || 'Grille');

    try {
      const res = await fetch(`/api/regles/${regle.id}/configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          libelle,
          content: pendingGrille,
          activate: true,
          grille_uuid: grilleUuid,
          grille_nom: grilleNom
        })
      });
      if (res.ok) {
        setIsEditorOpen(false);
        setIsNewMode(false);
        setPendingGrilleUuid(null);
        refreshConfigs();
        addToast('Grille enregistrée avec succès', 'success');
      }
    } catch (e) {
      addToast("Erreur lors de l'enregistrement de la grille", 'error');
    }
  };

  const handleActivateConfig = async (configId) => {
    try {
      const res = await fetch(`/api/regles/${regle.id}/configs/${configId}/activate`, {
        method: 'POST'
      });
      if (res.ok) refreshConfigs();
    } catch (e) {
      addToast("Erreur lors de l'activation", 'error');
    }
  };

  const handleDeleteGrille = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`/api/regles/${regle.id}/grilles/${deleteConfirm.uuid}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        refreshConfigs();
      } else {
        addToast("Erreur lors de la suppression de la grille", 'error');
      }
    } catch (e) {
      addToast("Erreur lors de la suppression de la grille", 'error');
    }
  };

  const handleMoveGrille = async (uuid, direction) => {
    const uuids = Object.keys(grillesGroups);
    const index = uuids.indexOf(uuid);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= uuids.length) return;

    const newUuids = [...uuids];
    [newUuids[index], newUuids[newIndex]] = [newUuids[newIndex], newUuids[index]];

    const orders = newUuids.map((id, idx) => ({ uuid: id, ordre: idx }));

    try {
      const res = await fetch(`/api/regles/${regle.id}/grilles/order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders })
      });
      if (res.ok) refreshConfigs();
    } catch (e) {
      addToast("Erreur lors du déplacement de la grille", 'error');
    }
  };

  // Grouper les configs pour l'affichage
  const grillesGroups = {};
  // On s'assure que configs est trié par grille_ordre s'il existe
  const sortedConfigs = [...(configs || [])].sort((a, b) => (a.grille_ordre || 0) - (b.grille_ordre || 0));
  
  sortedConfigs.forEach(c => {
    const uuid = c.grille_uuid || 'default';
    if (!grillesGroups[uuid]) grillesGroups[uuid] = [];
    grillesGroups[uuid].push(c);
  });

  return (
    <div className="objectifs-onglet">
      <div className="objectifs-onglet__header-actions">
        <button className="btn-toolbar btn-toolbar--new" onClick={() => { setIsNewMode(true); setIsEditorOpen(true); }}>
          <i className="fa-solid fa-plus"></i> Créer une nouvelle Grille indépendante
        </button>
      </div>

      <div className="objectifs-onglet__section-wrapper">
        <KpiGridSection regle={regle} />
      </div>

      <div className="objectifs-onglet__separator"></div>

      {Object.entries(grillesGroups).length === 0 && (
        <div className="objectifs-onglet__empty">
            <i className="fa-solid fa-bullseye"></i>
            <p>Aucune grille configurée. Cliquez sur le bouton ci-dessus pour commencer.</p>
        </div>
      )}

      {Object.entries(grillesGroups).map(([uuid, versions], index, array) => {
        const selectedId = selectedVersions[uuid];
        const currentVersion = versions.find(v => v.id === selectedId) || versions[0];
        
        return (
          <div key={uuid} className="grille-container-wrapper">
            <ToolbarSection 
              title={currentVersion.grille_nom || 'Grille'}
              configs={versions}
              activeConfigId={selectedId}
              onSelectConfig={(id) => setSelectedVersions(prev => ({ ...prev, [uuid]: id }))}
              onActivateConfig={handleActivateConfig}
              onEdit={() => {
                setPendingGrilleUuid(uuid);
                setIsNewMode(false);
                setIsEditorOpen(true);
              }}
              onDelete={() => setDeleteConfirm({ uuid, nom: currentVersion.grille_nom || 'cette grille' })}
              onMoveUp={() => handleMoveGrille(uuid, 'up')}
              onMoveDown={() => handleMoveGrille(uuid, 'down')}
              isFirst={index === 0}
              isLast={index === array.length - 1}
            />
            <GrilleSection grille={currentVersion.content} />
            <div className="objectifs-onglet__separator"></div>
          </div>
        );
      })}

      <GrilleEditorModal 
        key={isNewMode ? 'new' : (pendingGrilleUuid || 'edit')}
        isOpen={isEditorOpen}
        onClose={() => { setIsEditorOpen(false); setIsNewMode(false); setPendingGrilleUuid(null); }}
        onSave={(data) => handleSaveGrille(data, pendingGrilleUuid)}
        initialData={isNewMode ? null : ((configs || []).find(c => c.id === selectedVersions[pendingGrilleUuid])?.content)}
      />

      <SaveVersionModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onConfirm={handleConfirmSaveVersion}
        isNewGrille={isNewMode}
      />

      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteGrille}
        title="Supprimer la grille"
        message={`Êtes-vous sûr de vouloir supprimer la grille "${deleteConfirm?.nom}" ? Toutes ses versions seront définitivement supprimées.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
      />
    </div>
  );
}

