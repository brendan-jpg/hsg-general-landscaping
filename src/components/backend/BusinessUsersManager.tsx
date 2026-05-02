import PendingSubmitButton from '@/components/backend/PendingSubmitButton';
import DeleteIcon from '@/components/shared/icons/DeleteIcon';
import { deleteBusinessUserAccessAction, inviteBusinessUserAction, updateBusinessUserAccessAction } from '@/lib/actions';
import type { ManagedBusinessUser } from '@/lib/users/queries';
import { formatPhone } from '@/lib/utils';

interface BusinessUsersManagerProps {
  businessId: string;
  users: ManagedBusinessUser[];
  title: string;
  description?: string;
}

function formatUserName(user: ManagedBusinessUser) {
  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  if (fullName) return fullName;
  return user.email || 'User';
}

export default function BusinessUsersManager({
  businessId,
  users,
  title,
  description,
}: BusinessUsersManagerProps) {
  if (!businessId) {
    return (
      <section className="settings-card business-users">
        <div className="platform-section__head">
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        <p className="platform-empty">Select a client first.</p>
      </section>
    );
  }

  return (
    <section className="settings-card business-users">
      <div className="platform-section__head">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>

      <form action={inviteBusinessUserAction} className="business-users__invite">
        <input type="hidden" name="business_id" value={businessId} />
        <label>
          First Name
          <input name="first_name" type="text" placeholder="Jane" />
        </label>
        <label>
          Last Name
          <input name="last_name" type="text" placeholder="Doe" />
        </label>
        <label>
          Email
          <input name="email" type="email" required placeholder="jane@client.com" />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" placeholder="203-555-0123" />
        </label>
        <label>
          Role
          <select name="role" defaultValue="employee">
            <option value="employee">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <PendingSubmitButton idleLabel="Invite User" pendingLabel="Inviting..." />
      </form>

      {users.length === 0 ? (
        <p className="platform-empty">No tenant users yet.</p>
      ) : (
        <div className="business-users__list">
          {users.map((user) => (
            <form
              key={user.id}
              action={updateBusinessUserAccessAction}
              className={`business-users__row ${user.is_platform_admin ? 'business-users__row--platform' : ''}`}
            >
              <input type="hidden" name="business_id" value={businessId} />
              <input type="hidden" name="user_id" value={user.id} />
              <fieldset className="business-users__row-fields" disabled={user.is_platform_admin}>
                <div className="business-users__identity">
                  <strong>{formatUserName(user)}</strong>
                  <span>{user.email || 'No auth email found'}</span>
                  {user.phone ? <span>{formatPhone(user.phone)}</span> : null}
                </div>
                <label>
                  Phone
                  <input name="phone" type="tel" defaultValue={user.phone ? formatPhone(user.phone) : ''} placeholder="203-555-0123" />
                </label>
                <label>
                  Role
                  <select name="role" defaultValue={user.role}>
                    <option value="employee">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <PendingSubmitButton
                  idleLabel="Save"
                  pendingLabel="Saving..."
                />
                {!user.is_platform_admin ? (
                  <button
                    type="submit"
                    className="btn btn--icon business-users__delete-btn"
                    formAction={async () => {
                      'use server';
                      await deleteBusinessUserAccessAction(user.id, businessId);
                    }}
                    aria-label={`Delete ${formatUserName(user)}`}
                    title="Delete user"
                  >
                    <DeleteIcon />
                  </button>
                ) : null}
              </fieldset>
            </form>
          ))}
        </div>
      )}
    </section>
  );
}
