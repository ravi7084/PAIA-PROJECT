const VerificationBadge = ({ verified }) => {
  return (
    <span className={`pill ${verified ? 'pill-green' : 'pill-amber'}`}>
      {verified ? 'Verified' : 'Not verified'}
    </span>
  );
};

export default VerificationBadge;