const RoleBadge = ({ role }) => {
  const isAdmin = role === 'admin';

  return (
    <span className={`pill ${isAdmin ? 'pill-red' : 'pill-indigo'}`}>
      {isAdmin ? 'Admin' : 'User'}
    </span>
  );
};

export default RoleBadge;