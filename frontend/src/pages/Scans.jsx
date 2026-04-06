import Layout from '../components/layout';
import AutoReconPanel from '../components/AutoReconPanel';

const Scans = () => {
  return (
    <Layout>
      <div className="page-header">
        <h2>Scan Center</h2>
        <p>Run Reconnaissance, Subdomain/DNS, and Network scans from one place.</p>
      </div>

      <AutoReconPanel />
    </Layout>
  );
};

export default Scans;
