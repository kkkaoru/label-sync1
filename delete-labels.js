const REPOSITORIES = require('./repositories.json');


const DELETED_LABEL_PREFIX = process.env.DELETE_LABEL_PREFIX || 'sync-';

// GraphQLエンドポイント
const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';

// ヘッダー
const headers = {
  Authorization: `Bearer ${process.env.GH_TOKEN}`,
  'Content-Type': 'application/json',
};

// ラベルを取得するクエリ
const getLabelsQuery = (owner, name) => `
{
  repository(owner: "${owner}", name: "${name}") {
    labels(first: 100) {
      nodes {
        id
        name
      }
    }
  }
}
`;

// ラベルを削除するMutation
const deleteLabelMutation = (labelId) => `
mutation {
  deleteLabel(input: {id: "${labelId}"}) {
    clientMutationId
  }
}
`;

async function fetchLabels(owner, name) {
  const query = getLabelsQuery(owner, name);
  const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ query: query }),
  });

  const data = await response.json();
  if (!data.data || !data.data.repository) {
    throw new Error(`Failed to fetch labels for ${owner}/${name}`);
  }

  return data.data.repository.labels.nodes.filter((label) => label.name.startsWith(DELETED_LABEL_PREFIX));
}

async function deleteLabel(labelId, owner, name) {
  const deleteMutation = deleteLabelMutation(labelId);
  const deleteResponse = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ query: deleteMutation }),
  });

  if (!deleteResponse.ok) {
    throw new Error(`Failed to delete label: ${labelId} from ${owner}/${name}`);
  }

  return `Deleted label: ${labelId} from ${owner}/${name}`;
}

// ラベルを取得して削除する関数
async function deleteCustomLabels() {
  try {
    const fetchLabelPromises = REPOSITORIES.map((repo) => fetchLabels(repo.owner, repo.name));
    const fetchedLabels = await Promise.allSettled(fetchLabelPromises);

    const deletePromises = fetchedLabels.flatMap((result, index) => {
      if (result.status !== 'fulfilled') {
        console.error(result.reason);
        return [];
      }
      const repo = REPOSITORIES[index];
      return result.value.length > 0
        ? result.value.map((label) => deleteLabel(label.id, repo.owner, repo.name))
        : (console.log(`No ${DELETED_LABEL_PREFIX} labels found in ${repo.owner}/${repo.name}`), []);
    });

    if (deletePromises.length === 0) {
      console.log('No labels to delete.');
      return;
    }

    const resultDeletePromises = await Promise.allSettled(deletePromises);
    for (const result of resultDeletePromises) {
      if (result.status === 'fulfilled') {
        console.log(result.value);
      } else {
        console.error(result.reason);
      }
		}

    console.log(`Completed deleting ${DELETED_LABEL_PREFIX} labels from all repositories.`);
  } catch (error) {
    console.error('Error fetching or deleting labels:', error);
  }
}

// ラベル削除関数を実行
deleteCustomLabels();
