import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Post } from '../lib/types';
import { PostCard } from '../components/Post';
import { Empty, PostSkeleton } from '../components/ui';

export default function PostPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['post', Number(id)], queryFn: () => api<Post>(`/posts/${id}`) });
  if (isLoading) return <PostSkeleton />;
  if (error || !data)
    return (
      <div className="card">
        <Empty title="Запись не найдена">Возможно, она была удалена.</Empty>
      </div>
    );
  return (
    <div className="col-main">
      <PostCard post={data} openComments />
    </div>
  );
}
