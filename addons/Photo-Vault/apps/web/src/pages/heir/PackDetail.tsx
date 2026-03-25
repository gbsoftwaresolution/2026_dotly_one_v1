import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { heirApi } from "../../api/heir";
import { Loading } from "../../components/Loading";

export const PackDetail = () => {
  const { id } = useParams();
  const [release, setRelease] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([heirApi.getRelease(id), heirApi.getReleaseItems(id)])
      .then(([relData, itemsData]) => {
        setRelease(relData);
        setItems(itemsData);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleOpen = async (itemId: string) => {
    try {
      if (!id) return;
      const res = await heirApi.openItem(id, itemId);
      // In a real app, this would trigger the Vault Viewer with the keys
      console.log("Vault Object Access:", res);
      alert(
        `Access Granted to Vault Object: ${res.vaultObjectId?.substr(0, 10)}...\n(Decryption enabled in full implementaton)`,
      );
    } catch (e) {
      alert("Failed to open item");
    }
  };

  if (loading) return <Loading />;
  if (!release) return <div>Not Found</div>;

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/app/heir/packs"
          className="text-sm text-gray-500 hover:text-gray-900 mb-2 block"
        >
          &larr; Back to Packs
        </Link>
        <h1 className="text-2xl font-bold">{release.pack.name}</h1>
        <p className="text-gray-500">{release.pack.description}</p>
        <div className="text-xs text-green-600 mt-1">
          Status: Active Release
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">
                Document
              </th>
              <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">
                Category
              </th>
              <th className="text-right py-3 px-4 font-medium text-sm text-gray-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b last:border-0 hover:bg-gray-50"
              >
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-800">{item.title}</div>
                </td>
                <td className="py-3 px-4">
                  {item.category && (
                    <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold">
                      {item.category}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => handleOpen(item.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Open Viewer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
