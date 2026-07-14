/*
 * UserPickerModal component for ipoc Web platform.
 *
 * PURPOSE:
 * - Reusable modal for selecting active users in incident command assignments, task ownership, objective assignments, etc.
 * - Provides search/filter UX for large user lists
 * - Follows Bootstrap professional UI guidelines from copilot-instructions.md
 *
 * FEATURES:
 * - Real-time search across displayName and emailAddress
 * - Lazy-loading of active users on modal open
 * - Loading states and error handling
 * - Keyboard-accessible selection
 *
 * SECURITY:
 * - Only displays active users (backend already filters IsActive = 1)
 * - No sensitive user data exposed (no Entra IDs, no phone numbers)
 */

import { useEffect, useState } from 'react';
import {
  Form,
  ListGroup,
  Modal,
  Spinner,
} from 'react-bootstrap';
import { getActiveUsers } from '../../api';
import IconActionButton from './IconActionButton';
import LabelWithInfo from './LabelWithInfo';
import type { ActiveUser } from '../../types';

interface UserPickerModalProps {
  show: boolean;
  onHide: () => void;
  onSelect: (user: ActiveUser) => void | boolean | Promise<void | boolean>;
  title?: string;
}

export default function UserPickerModal({
  show,
  onHide,
  onSelect,
  title = 'Select User',
}: UserPickerModalProps) {
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectingUserId, setSelectingUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!show) {
      return;
    }

    const loadUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        setSelectionError(null);
        const activeUsers = await getActiveUsers();
        setUsers(activeUsers);
        setFilteredUsers(activeUsers);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Unable to load users.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadUsers();
  }, [show]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = users.filter(
      (user) =>
        user.displayName.toLowerCase().includes(lowerQuery) ||
        (user.emailAddress && user.emailAddress.toLowerCase().includes(lowerQuery))
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const handleSelect = async (user: ActiveUser) => {
    try {
      setSelectionError(null);
      setSelectingUserId(user.userId);
      const result = await Promise.resolve(onSelect(user));
      if (result === false) {
        setSelectionError('Assignment failed — retry.');
        return;
      }

      setSearchQuery('');
      onHide();
    } catch {
      setSelectionError('Assignment failed — retry.');
    } finally {
      setSelectingUserId(null);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title className="small fw-semibold">
          <i className="bi bi-person-plus me-2" aria-hidden="true" />
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label className="small mb-1"><LabelWithInfo text="Search Users" info="Search active users by display name or email address." /></Form.Label>
          <Form.Control
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </Form.Group>

        {loading && (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" role="status">
              <span className="visually-hidden">Loading users...</span>
            </Spinner>
          </div>
        )}

        {error && (
          <div className="alert alert-danger small" role="alert">
            <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />
            {error}
          </div>
        )}

        {!error && selectionError && (
          <div className="alert alert-warning small" role="alert">
            <i className="bi bi-exclamation-circle me-2" aria-hidden="true" />
            {selectionError}
          </div>
        )}

        {!loading && !error && filteredUsers.length === 0 && (
          <div className="text-muted text-center py-4 small">
            <i className="bi bi-inbox me-2" aria-hidden="true" />
            No users found.
          </div>
        )}

        {!loading && !error && filteredUsers.length > 0 && (
          <ListGroup style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {filteredUsers.map((user) => (
              <ListGroup.Item
                key={user.userId}
                action
                onClick={() => handleSelect(user)}
                className="d-flex justify-content-between align-items-start"
                style={{ cursor: selectingUserId === user.userId ? 'progress' : 'pointer' }}
              >
                <div>
                  <div className="fw-semibold small">{user.displayName}</div>
                  {user.emailAddress && (
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      <i className="bi bi-envelope me-1" aria-hidden="true" />
                      {user.emailAddress}
                    </div>
                  )}
                  {user.organizationName && (
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      <i className="bi bi-building me-1" aria-hidden="true" />
                      {user.organizationName}
                    </div>
                  )}
                </div>
                {selectingUserId === user.userId
                  ? <Spinner animation="border" size="sm" aria-hidden="true" />
                  : <i className="bi bi-chevron-right text-muted" aria-hidden="true" />}
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Modal.Body>
      <Modal.Footer>
        <IconActionButton
          iconClassName="bi bi-x-circle"
          tooltip="Cancel and close user picker"
          ariaLabel="Cancel user selection"
          onClick={onHide}
          variant="outline-secondary"
        />
      </Modal.Footer>
    </Modal>
  );
}
