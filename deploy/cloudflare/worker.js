// すべてのリクエストを 1 つのコンテナ（アプリ）に転送する。
// アプリはメモリ上にデータを持つので、インスタンスは常に 1 つだけにする。
import { Container, getContainer } from '@cloudflare/containers';

export class AppContainer extends Container {
  defaultPort = 3000;
  sleepAfter = '6h'; // この時間アクセスがなければ停止する（停止するとデータは消える）
}

export default {
  async fetch(request, env) {
    return getContainer(env.APP, 'main').fetch(request);
  },
};
