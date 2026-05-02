'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import DeleteIcon from '@/components/shared/icons/DeleteIcon';
import { deleteTeamMembersBulk, reorderTeamMembersAction } from '@/lib/actions';

interface TeamAdminMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  sort_order: number;
  website_published: boolean | null;
  employment?: {
    employment_status?: string | null;
    login_status?: string | null;
    pay_type?: string | null;
    salary_amount?: number | null;
    hourly_rate?: number | null;
  } | null;
}

interface TeamAdminListProps {
  members: TeamAdminMember[];
  bulkPortalTargetId?: string;
  headerAction?: ReactNode;
}

function sanitizeSortOrder(value: string) {
  return value.replace(/[^0-9]/g, '');
}

function formatEmploymentStatus(value: string | null | undefined) {
  if (!value) return '-';
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTeamMemberName(member: { first_name: string | null; last_name: string | null }) {
  return [member.first_name, member.last_name].filter(Boolean).join(' ').trim() || 'Unnamed Team Member';
}

export default function TeamAdminList({ members, bulkPortalTargetId, headerAction }: TeamAdminListProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortDrafts, setSortDrafts] = useState<Record<string, string>>(
    Object.fromEntries(members.map((member) => [member.id, String(member.sort_order)])),
  );
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isDeleting, startDeletingTransition] = useTransition();
  const [bulkPortalTarget, setBulkPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSortDrafts(Object.fromEntries(members.map((member) => [member.id, String(member.sort_order)])));
  }, [members]);

  const displayedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const aOrder = Number.parseInt(sortDrafts[a.id] ?? String(a.sort_order), 10) || 0;
        const bOrder = Number.parseInt(sortDrafts[b.id] ?? String(b.sort_order), 10) || 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return formatTeamMemberName(a).localeCompare(formatTeamMemberName(b));
      }),
    [members, sortDrafts],
  );

  useEffect(() => {
    if (!bulkPortalTargetId) {
      setBulkPortalTarget(null);
      return;
    }
    setBulkPortalTarget(document.getElementById(bulkPortalTargetId));
  }, [bulkPortalTargetId]);

  const allRowIds = useMemo(() => displayedMembers.map((member) => member.id), [displayedMembers]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = displayedMembers.length > 0 && selectedIds.length === displayedMembers.length;
  const isOrderDirty = useMemo(
    () => members.some((member) => (sortDrafts[member.id] ?? '') !== String(member.sort_order)),
    [members, sortDrafts],
  );

  useEffect(() => {
    const validIds = new Set(allRowIds);
    setSelectedIds((current) => current.filter((id) => validIds.has(id)));
  }, [allRowIds]);

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) => (checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id)));
  }

  function openMember(memberId: string) {
    router.push(`/dashboard/team/${memberId}`);
  }

  async function persistOrder() {
    setOrderError(null);
    setIsSavingOrder(true);

    try {
      await reorderTeamMembersAction(
        members.map((member) => ({
          id: member.id,
          sort_order: Number.parseInt(sortDrafts[member.id] ?? String(member.sort_order), 10) || 0,
        })),
      );
      router.refresh();
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'Unable to save team order');
    } finally {
      setIsSavingOrder(false);
    }
  }

  const bulkControls = (
    <div className="data-table__bulk-bar">
      <div className="data-table__bulk-action">
        {selectedIds.length > 0 && (
          <button
            type="button"
            className="media-picker__icon-btn media-picker__icon-btn--danger media-picker__icon-btn--flat"
            disabled={isDeleting || isSavingOrder}
            title={isDeleting ? 'Deleting...' : `Delete selected (${selectedIds.length})`}
            aria-label={isDeleting ? 'Deleting selected team members' : `Delete ${selectedIds.length} selected team members`}
            onClick={() => {
              if (selectedIds.length === 0) return;
              const confirmed = window.confirm(`Delete ${selectedIds.length} team members? This cannot be undone.`);
              if (!confirmed) return;

              startDeletingTransition(async () => {
                await deleteTeamMembersBulk(selectedIds);
                setSelectedIds([]);
                router.refresh();
              });
            }}
          >
            <DeleteIcon />
          </button>
        )}
      </div>
      <span className="data-table__bulk-total">
        {selectedIds.length > 0 ? `${selectedIds.length} Selected` : `${displayedMembers.length} Total`}
      </span>
      <div className="service-admin-bulk-side">
        {(isSavingOrder || orderError) && (
          <span className={`service-admin-save-state ${orderError ? 'service-admin-save-state--error' : ''}`}>
            {orderError ? orderError : 'Saving order...'}
          </span>
        )}
        {isOrderDirty && (
          <button
            type="button"
            className="btn"
            disabled={isSavingOrder || isDeleting}
            onClick={() => void persistOrder()}
          >
            Save Sort Order
          </button>
        )}
      </div>
    </div>
  );

  if (displayedMembers.length === 0) {
    return (
      <div className="service-admin-empty">
        {headerAction ? <div className="service-admin-empty__action">{headerAction}</div> : null}
        <div className="empty-state">
          <p>No team members yet.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {bulkPortalTargetId && bulkPortalTarget ? createPortal(bulkControls, bulkPortalTarget) : bulkControls}
      <div className="team-admin-table">
        <div className="team-admin-list__header">
          <label className="service-admin-select service-admin-select--header" aria-label="Select all team members">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => setSelectedIds(event.target.checked ? [...allRowIds] : [])}
              aria-label="Select all team members"
            />
          </label>
          <div className="team-admin-list__header-labels">
            <span>Sort</span>
            <span>Team Member</span>
            <span>Title</span>
            <span>Website</span>
            <span>Employment</span>
          </div>
          {headerAction ? <div className="team-admin-list__header-action">{headerAction}</div> : null}
        </div>
        <div className="team-admin-list">
          {displayedMembers.map((member) => {
            const isSelected = selectedIdSet.has(member.id);
            return (
              <div
                key={member.id}
                className={`team-admin-row ${isSelected ? 'team-admin-row--selected' : ''}`}
                onClick={() => openMember(member.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openMember(member.id);
                  }
                }}
                role="link"
                tabIndex={0}
              >
                <label className="service-admin-select" aria-label={`Select ${formatTeamMemberName(member)}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(event) => toggleRow(member.id, event.target.checked)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </label>
                <div className="team-admin-row__grid">
                  <label className="service-admin-sort-field" aria-label={`Sort order for ${formatTeamMemberName(member)}`}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={sortDrafts[member.id] ?? String(member.sort_order)}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        setSortDrafts((current) => ({
                          ...current,
                          [member.id]: sanitizeSortOrder(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <Link
                    href={`/dashboard/team/${member.id}`}
                    className="team-admin-row__name"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {formatTeamMemberName(member)}
                  </Link>
                  <span>{member.title ?? '-'}</span>
                  <span>{member.website_published ? 'Published' : 'Hidden'}</span>
                  <span>{formatEmploymentStatus(member.employment?.employment_status)}</span>
                </div>
                <div className="team-admin-row__action-spacer" aria-hidden="true" />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
