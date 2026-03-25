import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { heirApi } from "../../api/heir";
import { Loading } from "../../components/Loading";

export const ReleasedPacks = () => {
  const [packs, setPacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    heirApi
      .getReleases()
      .then(setPacks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Released Packs</h1>
      {packs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded shadow-sm">
          <p className="text-gray-500">
            No packs are currently released to you.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {packs.map((release) => (
            <div
              key={release.id}
              className="bg-white p-6 rounded shadow-sm border border-l-4 border-l-green-500 flex justify-between items-center"
            >
              <div>
                <h3 className="font-bold text-lg">{release.pack.name}</h3>
                <p className="text-gray-600 text-sm">
                  {release.pack.description}
                </p>
                <div className="text-xs text-gray-400 mt-2">
                  Released: {new Date(release.releasedAt).toLocaleDateString()}
                </div>
              </div>
              <Link
                to={`/app/heir/packs/${release.id}`}
                className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded text-sm font-medium"
              >
                View Content
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
