import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LifeDocsTabs } from "../../components/LifeDocsTabs";
import { continuityApi } from "../../api/continuity";
import { Loading } from "../../components/Loading";

export const ContinuityDashboard = () => {
  const [packs, setPacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await continuityApi.getPacks();
      setPacks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Life Protocols & Continuity</h1>
      <p className="text-gray-500 mb-8">
        Establish secure inheritance rules for your encrypted vault.
      </p>

      <LifeDocsTabs activeTab="continuity" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded shadow border-l-4 border-l-blue-500">
          <h3 className="font-bold text-lg mb-2">Continuity Packs</h3>
          <p className="text-sm text-gray-600 mb-4">
            Bundles of documents prepared for release.
          </p>
          <div className="text-xs text-gray-500 mb-3">
            You have {packs.length} pack(s).
          </div>
          <Link
            to="/apps/life-docs/continuity/packs"
            className="text-blue-600 font-medium hover:underline"
          >
            Manage Packs &rarr;
          </Link>
        </div>
        <div className="bg-white p-6 rounded shadow border-l-4 border-l-orange-500">
          <h3 className="font-bold text-lg mb-2">Heirs & Recipients</h3>
          <p className="text-sm text-gray-600 mb-4">
            Trusted contacts verified to receive efficient access.
          </p>
          <Link
            to="/apps/life-docs/continuity/recipients"
            className="text-blue-600 font-medium hover:underline"
          >
            Manage Heirs &rarr;
          </Link>
        </div>
        <div className="bg-white p-6 rounded shadow border-l-4 border-l-purple-500">
          <h3 className="font-bold text-lg mb-2">Release Triggers</h3>
          <p className="text-sm text-gray-600 mb-4">
            Conditions that must be met to unlock a pack.
          </p>
          <Link
            to="/apps/life-docs/continuity/policies"
            className="text-blue-600 font-medium hover:underline"
          >
            Manage Policies &rarr;
          </Link>
        </div>
      </div>

      <div className="bg-slate-50 p-6 rounded border">
        <h3 className="font-bold mb-4">Recent Actvity</h3>
        <div className="text-sm text-gray-500 italic">
          No recent continuity events recorded.
        </div>
      </div>
    </div>
  );
};
