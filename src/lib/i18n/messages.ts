export const locales = ["en", "es", "de", "pt", "ja", "zh", "ru"] as const;
export type Locale = (typeof locales)[number];
export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  de: "Deutsch",
  pt: "Português",
  ja: "日本語",
  zh: "中文",
  ru: "Русский",
};
export function validLocale(value: string | undefined): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : "en";
}
// Columns: English, Spanish, German, Portuguese, Japanese, Chinese, Russian.
const rows = `
Overview|Resumen|Übersicht|Visão geral|概要|概览|Обзор
Trending|Tendencias|Trends|Tendências|トレンド|趋势|Тренды
Watchlist|Seguimiento|Merkliste|Lista de acompanhamento|ウォッチリスト|关注列表|Избранное
My radars|Mis radares|Meine Radare|Meus radares|マイレーダー|我的雷达|Мои радары
Reports|Informes|Berichte|Relatórios|レポート|报告|Отчёты
Teams & clients|Equipos y clientes|Teams und Kunden|Equipes e clientes|チームと顧客|团队与客户|Команды и клиенты
Notifications|Notificaciones|Benachrichtigungen|Notificações|通知|通知|Уведомления
Data sources|Fuentes de datos|Datenquellen|Fontes de dados|データソース|数据来源|Источники данных
Settings|Configuración|Einstellungen|Configurações|設定|设置|Настройки
Administration|Administración|Administration|Administração|管理|管理|Администрирование
WORKSPACE|ESPACIO DE TRABAJO|ARBEITSBEREICH|ESPAÇO DE TRABALHO|ワークスペース|工作区|РАБОЧЕЕ ПРОСТРАНСТВО
Log out|Cerrar sesión|Abmelden|Sair|ログアウト|退出登录|Выйти
Log in|Iniciar sesión|Anmelden|Entrar|ログイン|登录|Войти
Start free|Empezar gratis|Kostenlos starten|Começar grátis|無料で始める|免费开始|Начать бесплатно
Start free ↗|Empezar gratis ↗|Kostenlos starten ↗|Começar grátis ↗|無料で始める ↗|免费开始 ↗|Начать бесплатно ↗
How it works|Cómo funciona|So funktioniert es|Como funciona|仕組み|工作原理|Как это работает
Pricing|Precios|Preise|Preços|料金|价格|Тарифы
Explore|Explorar|Entdecken|Explorar|探索|探索|Обзор возможностей
Privacy|Privacidad|Datenschutz|Privacidade|プライバシー|隐私|Конфиденциальность
Terms|Términos|Bedingungen|Termos|利用規約|条款|Условия
Evidence first. AI second.|Primero la evidencia. Después la IA.|Erst Belege. Dann KI.|Evidências primeiro. IA depois.|証拠が先。AIは後。|证据优先，AI其次。|Сначала факты. Затем ИИ.
Go deeper. Build smarter.|Investiga más. Construye mejor.|Tiefer forschen. Besser entwickeln.|Pesquise mais. Crie melhor.|深く調べ、賢く作る。|深入研究，明智构建。|Изучай глубже. Создавай лучше.
Explore plans|Ver planes|Tarife ansehen|Ver planos|プランを見る|查看套餐|Посмотреть тарифы
Evidence-first workspace|Espacio basado en evidencia|Belegbasierter Arbeitsbereich|Espaço baseado em evidências|証拠に基づくワークスペース|以证据为基础的工作区|Рабочее пространство на основе фактов
Setup required|Configuración necesaria|Einrichtung erforderlich|Configuração necessária|設定が必要|需要配置|Требуется настройка
Search opportunities|Buscar oportunidades|Chancen suchen|Buscar oportunidades|機会を検索|搜索机会|Поиск возможностей
Search problems, industries, audiences…|Buscar problemas, sectores, públicos…|Probleme, Branchen, Zielgruppen suchen…|Buscar problemas, setores, públicos…|課題・業界・対象者を検索…|搜索问题、行业、受众…|Поиск проблем, отраслей, аудитории…
Radar overview|Resumen del radar|Radarübersicht|Visão geral do radar|レーダー概要|雷达概览|Обзор радара
Create radar|Crear radar|Radar erstellen|Criar radar|レーダーを作成|创建雷达|Создать радар
Opportunities|Oportunidades|Chancen|Oportunidades|機会|机会|Возможности
Signals collected|Señales recopiladas|Gesammelte Signale|Sinais coletados|収集されたシグナル|已收集信号|Собрано сигналов
Active radars|Radares activos|Aktive Radare|Radares ativos|稼働中のレーダー|活跃雷达|Активные радары
Saved opportunities|Oportunidades guardadas|Gespeicherte Chancen|Oportunidades salvas|保存した機会|已保存机会|Сохранённые возможности
Evidence-backed problems|Problemas con evidencia|Belegte Probleme|Problemas com evidências|証拠のある課題|有证据的问题|Проблемы с подтверждениями
Public conversations|Conversaciones públicas|Öffentliche Gespräche|Conversas públicas|公開の会話|公开讨论|Публичные обсуждения
Your tracked interests|Tus intereses seguidos|Ihre verfolgten Interessen|Seus interesses acompanhados|追跡中の関心分野|您关注的领域|Ваши интересы
Your watchlist|Tu lista de seguimiento|Ihre Merkliste|Sua lista de acompanhamento|ウォッチリスト|您的关注列表|Ваше избранное
Top opportunities|Mejores oportunidades|Beste Chancen|Principais oportunidades|注目の機会|热门机会|Лучшие возможности
View all ↗|Ver todo ↗|Alle ansehen ↗|Ver tudo ↗|すべて見る ↗|查看全部 ↗|Посмотреть все ↗
Market signal history|Historial de señales|Signalverlauf|Histórico de sinais|シグナル履歴|信号历史|История сигналов
Fastest growing|Mayor crecimiento|Schnellstes Wachstum|Maior crescimento|急成長|增长最快|Самый быстрый рост
New today|Nuevas hoy|Heute neu|Novas hoje|今日の新着|今日新增|Новое сегодня
View source connections|Ver fuentes conectadas|Quellen ansehen|Ver fontes conectadas|接続されたソースを見る|查看来源连接|Посмотреть источники
Not enough evidence yet.|Aún no hay suficiente evidencia.|Noch nicht genügend Belege.|Ainda não há evidências suficientes.|証拠がまだ不足しています。|证据还不够。|Пока недостаточно подтверждений.
Collection monitor|Estado de recopilación|Erfassungsmonitor|Monitor de coleta|収集モニター|采集监控|Монитор сбора
Live pipeline|Proceso en vivo|Live-Verarbeitung|Processamento ao vivo|処理状況|实时流程|Процесс в реальном времени
Collecting sources|Recopilando fuentes|Quellen erfassen|Coletando fontes|ソースを収集中|正在采集来源|Сбор источников
Creating embeddings|Creando vectores|Vektoren erstellen|Criando vetores|ベクトルを作成中|正在创建向量|Создание векторов
Checking related signals|Comprobando señales relacionadas|Ähnliche Signale prüfen|Verificando sinais relacionados|関連シグナルを確認中|正在检查相关信号|Проверка похожих сигналов
Analyzing evidence|Analizando evidencia|Belege analysieren|Analisando evidências|証拠を分析中|正在分析证据|Анализ подтверждений
Publishing results|Publicando resultados|Ergebnisse veröffentlichen|Publicando resultados|結果を公開中|正在发布结果|Публикация результатов
Batch completed|Lote terminado|Teilmenge abgeschlossen|Lote concluído|バッチ完了|批次完成|Партия завершена
Running|En curso|Läuft|Em execução|実行中|运行中|Выполняется
Completed|Terminado|Abgeschlossen|Concluído|完了|已完成|Завершено
Failed|Error|Fehlgeschlagen|Falhou|失敗|失败|Ошибка
Not started|No iniciado|Nicht gestartet|Não iniciado|未開始|尚未开始|Не запускался
Signals|Señales|Signale|Sinais|シグナル|信号|Сигналы
Embeddings ready|Vectores listos|Vektoren bereit|Vetores prontos|作成済みベクトル|向量已就绪|Готовые векторы
Waiting for embeddings|Esperando vectores|Warten auf Vektoren|Aguardando vetores|ベクトル待ち|等待向量|Ожидают векторов
Pain clusters|Grupos de problemas|Problemgruppen|Grupos de problemas|課題クラスター|问题分组|Группы проблем
Latest signals|Últimas señales|Neueste Signale|Sinais recentes|最新シグナル|最新信号|Последние сигналы
Source coverage|Cobertura de fuentes|Quellenabdeckung|Cobertura de fontes|ソースの範囲|来源覆盖|Охват источников
Enabled|Activado|Aktiviert|Ativado|有効|已启用|Включён
Disabled|Desactivado|Deaktiviert|Desativado|無効|已禁用|Выключен
Partial crawl|Recorrido parcial|Teilweise erfasst|Coleta parcial|部分的な収集|部分采集|Частичный обход
Healthy|Correcto|In Ordnung|Saudável|正常|正常|Работает
Refresh|Actualizar|Aktualisieren|Atualizar|更新|刷新|Обновить
Continue processing|Continuar procesamiento|Verarbeitung fortsetzen|Continuar processamento|処理を続ける|继续处理|Продолжить обработку
Start collection|Iniciar recopilación|Erfassung starten|Iniciar coleta|収集を開始|开始采集|Начать сбор
Request sent|Solicitud enviada|Anfrage gesendet|Solicitação enviada|リクエスト送信済み|请求已发送|Запрос отправлен
Working…|Procesando…|In Arbeit…|Processando…|処理中…|处理中…|Выполняется…
Queued|En cola|In Warteschlange|Na fila|待機中|排队中|В очереди
Last updated|Última actualización|Zuletzt aktualisiert|Última atualização|最終更新|上次更新|Обновлено
Auto-refresh every 10 seconds|Actualización cada 10 segundos|Aktualisierung alle 10 Sekunden|Atualização a cada 10 segundos|10秒ごとに更新|每10秒刷新|Автообновление каждые 10 секунд
One batch is complete; the remaining queue still needs processing.|Un lote terminó; la cola restante aún necesita procesamiento.|Eine Teilmenge ist fertig; die restliche Warteschlange muss noch verarbeitet werden.|Um lote terminou; a fila restante ainda precisa ser processada.|バッチは完了しましたが、残りのキューはまだ処理が必要です。|一个批次已完成，剩余队列仍需处理。|Партия завершена, но оставшаяся очередь ещё требует обработки.
No opportunities yet: a cluster needs similar evidence from at least 3 independent authors.|Aún no hay oportunidades: se necesitan señales similares de al menos 3 autores independientes.|Noch keine Chancen: Eine Gruppe benötigt ähnliche Belege von mindestens 3 unabhängigen Autoren.|Ainda não há oportunidades: um grupo precisa de evidências semelhantes de pelo menos 3 autores independentes.|機会はまだありません。グループには3人以上の独立した投稿者による類似の証拠が必要です。|暂无机会：分组需要至少3位独立作者的相似证据。|Возможностей пока нет: нужны похожие сигналы минимум от 3 независимых авторов.
The queue is processed in bounded batches to respect Gemini quotas.|La cola se procesa por lotes para respetar las cuotas de Gemini.|Die Warteschlange wird in begrenzten Teilmengen verarbeitet, um Gemini-Kontingente einzuhalten.|A fila é processada em lotes para respeitar as cotas do Gemini.|Geminiの制限に合わせてキューをバッチ処理します。|队列分批处理，以遵守Gemini配额。|Очередь обрабатывается партиями с учётом квот Gemini.
GitHub reads only the repositories listed below.|GitHub solo lee los repositorios indicados abajo.|GitHub liest nur die unten aufgeführten Repositories.|O GitHub lê apenas os repositórios abaixo.|GitHubは以下のリポジトリのみを読み取ります。|GitHub只读取以下列出的仓库。|GitHub читает только перечисленные ниже репозитории.
Data is not available. Try refreshing.|Datos no disponibles. Actualiza la página.|Daten nicht verfügbar. Erneut laden.|Dados indisponíveis. Atualize a página.|データを取得できません。更新してください。|数据不可用，请刷新。|Не удалось получить данные. Обновите страницу.
Collected signals and AI conclusions are different stages.|Las señales recopiladas y las conclusiones de IA son etapas distintas.|Gesammelte Signale und KI-Ergebnisse sind unterschiedliche Schritte.|Sinais coletados e conclusões da IA são etapas diferentes.|収集したシグナルとAIの結論は別の段階です。|采集信号和AI结论是不同阶段。|Собранные сигналы и выводы ИИ — разные этапы.
This run only processes existing signals; it does not collect new source pages.|Este proceso solo analiza señales existentes, sin recopilar páginas nuevas.|Dieser Lauf verarbeitet nur vorhandene Signale und erfasst keine neuen Quellseiten.|Esta execução processa apenas sinais existentes, sem coletar novas páginas.|既存のシグナルのみを処理し、新しいページは収集しません。|此任务仅处理现有信号，不采集新页面。|Этот запуск обрабатывает накопленные сигналы без сбора новых страниц.
Language|Idioma|Sprache|Idioma|言語|语言|Язык
Email|Correo electrónico|E-Mail|E-mail|メール|电子邮件|Электронная почта
Password|Contraseña|Passwort|Senha|パスワード|密码|Пароль
Name|Nombre|Name|Nome|名前|姓名|Имя
Save|Guardar|Speichern|Salvar|保存|保存|Сохранить
Cancel|Cancelar|Abbrechen|Cancelar|キャンセル|取消|Отмена
Delete|Eliminar|Löschen|Excluir|削除|删除|Удалить
Create|Crear|Erstellen|Criar|作成|创建|Создать
Edit|Editar|Bearbeiten|Editar|編集|编辑|Изменить
Search|Buscar|Suchen|Buscar|検索|搜索|Поиск
All|Todo|Alle|Tudo|すべて|全部|Все
Unread|Sin leer|Ungelesen|Não lidas|未読|未读|Непрочитанные
Mark all as read|Marcar todo como leído|Alle als gelesen markieren|Marcar todas como lidas|すべて既読にする|全部标记为已读|Прочитать все
Load more|Cargar más|Mehr laden|Carregar mais|さらに表示|加载更多|Загрузить ещё
Account settings|Configuración de cuenta|Kontoeinstellungen|Configurações da conta|アカウント設定|账户设置|Настройки аккаунта
API keys|Claves API|API-Schlüssel|Chaves API|APIキー|API密钥|API-ключи
Source|Fuente|Quelle|Fonte|ソース|来源|Источник
Never|Nunca|Nie|Nunca|なし|从未|Никогда
No recorded error|Sin errores registrados|Kein Fehler erfasst|Nenhum erro registrado|エラー記録なし|无错误记录|Ошибок не зарегистрировано
Close navigation|Cerrar navegación|Navigation schließen|Fechar navegação|ナビゲーションを閉じる|关闭导航|Закрыть меню
Open navigation|Abrir navegación|Navigation öffnen|Abrir navegação|ナビゲーションを開く|打开导航|Открыть меню
Source pages saved|Páginas guardadas|Gespeicherte Seiten|Páginas salvas|保存済みページ|已保存页面|Сохранено страниц
YOUR MARKET, IN FOCUS|TU MERCADO, EN FOCO|IHR MARKT IM FOKUS|SEU MERCADO EM FOCO|市場にフォーカス|聚焦您的市场|ВАШ РЫНОК В ФОКУСЕ
Follow real problems. Find where you can make a difference.|Sigue problemas reales. Encuentra dónde aportar valor.|Verfolgen Sie echte Probleme. Finden Sie Ihren Beitrag.|Acompanhe problemas reais. Encontre onde gerar valor.|実際の課題を追い、価値を生む場所を探しましょう。|关注真实问题，发现创造价值的机会。|Следите за реальными проблемами и находите, где принести пользу.
Not enough historical evidence to measure growth yet.|Aún faltan datos históricos para medir el crecimiento.|Noch zu wenig Verlauf, um Wachstum zu messen.|Ainda faltam dados históricos para medir o crescimento.|成長を測る履歴データがまだ不足しています。|历史数据不足，暂时无法衡量增长。|Пока недостаточно истории для оценки роста.
No new evidence-backed opportunities today.|Hoy no hay nuevas oportunidades con evidencia.|Heute keine neuen belegten Chancen.|Hoje não há novas oportunidades com evidências.|今日は新しい機会がありません。|今日暂无有证据支持的新机会。|Сегодня новых подтверждённых возможностей нет.
Real opportunities will appear here after enough independent signals have been collected.|Las oportunidades aparecerán cuando se recopilen suficientes señales independientes.|Chancen erscheinen, sobald genügend unabhängige Signale vorliegen.|As oportunidades aparecerão após coletar sinais independentes suficientes.|十分な独立したシグナルが集まると機会が表示されます。|收集足够的独立信号后，机会将显示在此处。|Возможности появятся после сбора достаточного числа независимых сигналов.
More radars, longer history, and actionable intelligence.|Más radares, más historial e información útil.|Mehr Radare, längerer Verlauf und nutzbare Erkenntnisse.|Mais radares, mais histórico e informações úteis.|より多くのレーダーと長い履歴、役立つ知見。|更多雷达、更长历史和可行的洞察。|Больше радаров, длиннее история, полезнее выводы.
Log in to your workspace|Accede a tu espacio|Im Arbeitsbereich anmelden|Entre no seu espaço|ワークスペースにログイン|登录工作区|Войти в рабочее пространство
MARKET INTELLIGENCE FOR BUILDERS|INTELIGENCIA DE MERCADO PARA CREADORES|MARKTWISSEN FÜR ENTWICKLER|INTELIGÊNCIA DE MERCADO PARA CRIADORES|作り手のための市場分析|为创造者提供市场洞察|АНАЛИЗ РЫНКА ДЛЯ СОЗДАТЕЛЕЙ
Great products start|Los grandes productos empiezan|Großartige Produkte beginnen|Grandes produtos começam|優れた製品は|优秀产品始于|Отличные продукты начинаются
with a|con un|mit einem|com um|ここから：|一个|с
real problem.|problema real.|echten Problem.|problema real.|本当の課題。|真实问题。|реальной проблемы.
Find problems worth building. PainRadar analyzes public conversations and finds growing problems people are actively trying to solve.|Encuentra problemas que merece la pena resolver. PainRadar analiza conversaciones públicas e identifica necesidades crecientes.|Finden Sie Probleme, die sich zu lösen lohnen. PainRadar analysiert öffentliche Gespräche und wachsende Bedürfnisse.|Encontre problemas que valem a pena resolver. PainRadar analisa conversas públicas e identifica necessidades crescentes.|PainRadarは公開の会話を分析し、人々が解決しようとしている課題を見つけます。|PainRadar分析公开讨论，发现人们正在努力解决且不断增长的问题。|Находите проблемы, которые стоит решать. PainRadar анализирует публичные обсуждения и выявляет растущие потребности.
Explore opportunities →|Explorar oportunidades →|Chancen entdecken →|Explorar oportunidades →|機会を探す →|探索机会 →|Посмотреть возможности →
Evidence-backed insights|Ideas con evidencia|Belegte Erkenntnisse|Insights com evidências|証拠に基づく知見|有证据的洞察|Выводы на основе фактов
No invented demand|Sin demanda inventada|Keine erfundene Nachfrage|Sem demanda inventada|架空の需要なし|不虚构需求|Без выдуманного спроса
PUBLIC CONVERSATIONS|CONVERSACIONES PÚBLICAS|ÖFFENTLICHE GESPRÄCHE|CONVERSAS PÚBLICAS|公開の会話|公开讨论|ПУБЛИЧНЫЕ ОБСУЖДЕНИЯ
Evidence → opportunity|Evidencia → oportunidad|Belege → Chance|Evidências → oportunidade|証拠 → 機会|证据 → 机会|Факты → возможность
One view. Signals from across the internet.|Una vista. Señales de toda la web.|Ein Überblick. Signale aus dem Internet.|Uma visão. Sinais de toda a internet.|インターネットのシグナルを一つの画面に。|一个视图，汇聚全网信号。|Один экран. Сигналы со всего интернета.
LESS GUESSWORK. MORE CONVICTION.|MENOS SUPOSICIONES. MÁS CERTEZA.|WENIGER VERMUTUNGEN. MEHR SICHERHEIT.|MENOS SUPOSIÇÕES. MAIS CERTEZA.|推測を減らし、確信を増やす。|减少猜测，增强信心。|МЕНЬШЕ ДОГАДОК. БОЛЬШЕ УВЕРЕННОСТИ.
Your next idea deserves evidence.|Tu próxima idea merece evidencia.|Ihre nächste Idee verdient Belege.|Sua próxima ideia merece evidências.|次のアイデアに、確かな証拠を。|您的下一个创意值得证据支持。|Ваша следующая идея заслуживает подтверждений.
Follow the problem from the first complaint to a validated opportunity.|Sigue el problema desde la primera queja hasta una oportunidad validada.|Verfolgen Sie ein Problem von der ersten Beschwerde bis zur belegten Chance.|Acompanhe o problema da primeira reclamação à oportunidade validada.|最初の不満から確認された機会まで追跡します。|从最初的抱怨追踪到经验证的机会。|От первого жалобного сообщения до подтверждённой возможности.
Hear the signal|Escucha la señal|Signale erkennen|Ouça o sinal|シグナルを聞く|倾听信号|Услышьте сигнал
Connect the dots|Conecta las señales|Zusammenhänge erkennen|Conecte os pontos|点をつなぐ|连接线索|Свяжите факты
Keywords / owner/repository / subreddit names|Palabras clave / propietario/repositorio / subreddits|Stichwörter / Eigentümer/Repository / Subreddits|Palavras-chave / proprietário/repositório / subreddits|キーワード / 所有者/リポジトリ / サブレディット|关键词 / 所有者/仓库 / 子版块|Ключевые слова / владелец/репозиторий / сабреддиты
Comma-separated values|Valores separados por comas|Kommagetrennte Werte|Valores separados por vírgulas|カンマ区切り|逗号分隔的值|Значения через запятую
Backfill start date (optional)|Fecha inicial (opcional)|Startdatum (optional)|Data inicial (opcional)|開始日（任意）|起始日期（可选）|Дата начала сбора (необязательно)
Maximum pages per pipeline run (1–10)|Máximo de páginas por ejecución (1–10)|Maximale Seiten je Lauf (1–10)|Máximo de páginas por execução (1–10)|実行ごとの最大ページ数（1～10）|每次运行最多页数（1–10）|Максимум страниц за запуск (1–10)
Configure source|Configurar fuente|Quelle konfigurieren|Configurar fonte|ソースを設定|配置来源|Настроить источник
Save configuration|Guardar configuración|Konfiguration speichern|Salvar configuração|設定を保存|保存配置|Сохранить настройки
Settings & billing|Configuración y facturación|Einstellungen und Abrechnung|Configurações e cobrança|設定と請求|设置与账单|Настройки и оплата
Create your account|Crea tu cuenta|Konto erstellen|Crie sua conta|アカウントを作成|创建账户|Создать аккаунт
Welcome back|Bienvenido de nuevo|Willkommen zurück|Bem-vindo de volta|おかえりなさい|欢迎回来|С возвращением
Reset password|Restablecer contraseña|Passwort zurücksetzen|Redefinir senha|パスワードを再設定|重置密码|Сбросить пароль
Set a new password|Nueva contraseña|Neues Passwort festlegen|Defina uma nova senha|新しいパスワードを設定|设置新密码|Задать новый пароль
Forgot password?|¿Olvidaste la contraseña?|Passwort vergessen?|Esqueceu a senha?|パスワードを忘れましたか？|忘记密码？|Забыли пароль?
Create account|Crear cuenta|Konto erstellen|Criar conta|アカウント作成|创建账户|Создать аккаунт
Already have an account?|¿Ya tienes cuenta?|Bereits ein Konto?|Já tem uma conta?|アカウントをお持ちですか？|已有账户？|Уже есть аккаунт?
New to PainRadar?|¿Nuevo en PainRadar?|Neu bei PainRadar?|Novo no PainRadar?|PainRadarは初めてですか？|首次使用PainRadar？|Впервые в PainRadar?
OR CONTINUE WITH|O CONTINÚA CON|ODER WEITER MIT|OU CONTINUE COM|または次で続行|或使用以下方式继续|ИЛИ ПРОДОЛЖИТЬ ЧЕРЕЗ
Resend verification email|Reenviar correo de verificación|Bestätigungs-E-Mail erneut senden|Reenviar e-mail de verificação|確認メールを再送信|重新发送验证邮件|Повторить письмо подтверждения
Privacy notice|Aviso de privacidad|Datenschutzhinweis|Aviso de privacidade|プライバシー通知|隐私声明|Политика конфиденциальности
Revoke|Revocar|Widerrufen|Revogar|取り消す|撤销|Отозвать
Run collection pipeline|Iniciar recopilación|Erfassung starten|Iniciar coleta|収集を開始|启动采集流程|Запустить сбор
THE ORIGIN OF EVERY INSIGHT|EL ORIGEN DE CADA HALLAZGO|DER URSPRUNG JEDER ERKENNTNIS|A ORIGEM DE CADA INSIGHT|すべての知見の源|每个洞察的来源|ИСТОЧНИК КАЖДОГО ВЫВОДА
Data collection setup|Configuración de recopilación|Erfassung einrichten|Configuração da coleta|収集の設定|采集设置|Настройка сбора данных
Not configured|Sin configurar|Nicht konfiguriert|Não configurado|未設定|未配置|Не настроен
Awaiting first collection|Esperando primera recopilación|Warten auf erste Erfassung|Aguardando primeira coleta|最初の収集待ち|等待首次采集|Ожидает первого сбора
Radar name|Nombre del radar|Radarname|Nome do radar|レーダー名|雷达名称|Название радара
Keywords, separated by commas|Palabras clave, separadas por comas|Stichwörter, durch Kommas getrennt|Palavras-chave separadas por vírgulas|キーワード（カンマ区切り）|关键词（逗号分隔）|Ключевые слова через запятую
Excluded words|Palabras excluidas|Ausgeschlossene Wörter|Palavras excluídas|除外する単語|排除词|Исключённые слова
Industries (optional)|Sectores (opcional)|Branchen (optional)|Setores (opcional)|業界（任意）|行业（可选）|Отрасли (необязательно)
Alert score threshold|Umbral de alerta|Alarmschwelle|Limite de alerta|通知スコアのしきい値|提醒评分阈值|Порог уведомлений
Frequency|Frecuencia|Häufigkeit|Frequência|頻度|频率|Частота
Enable collection|Activar recopilación|Erfassung aktivieren|Ativar coleta|収集を有効にする|启用采集|Включить сбор
Your account|Tu cuenta|Ihr Konto|Sua conta|アカウント|您的账户|Ваш аккаунт
Display name|Nombre visible|Anzeigename|Nome de exibição|表示名|显示名称|Отображаемое имя
Current password|Contraseña actual|Aktuelles Passwort|Senha atual|現在のパスワード|当前密码|Текущий пароль
New password|Nueva contraseña|Neues Passwort|Nova senha|新しいパスワード|新密码|Новый пароль
Confirm new password|Confirmar nueva contraseña|Neues Passwort bestätigen|Confirmar nova senha|新しいパスワードを確認|确认新密码|Повторите новый пароль
Active sessions|Sesiones activas|Aktive Sitzungen|Sessões ativas|有効なセッション|活跃会话|Активные сеансы
Positioning|Posicionamiento|Positionierung|Posicionamento|ポジショニング|定位|Позиционирование
Fit for this pain · AI inference|Adecuación al problema · Inferencia de IA|Eignung für dieses Problem · KI-Schlussfolgerung|Adequação ao problema · Inferência da IA|課題への適合度 · AI推論|问题适配度 · AI推断|Соответствие проблеме · Вывод ИИ
Reported advantages|Ventajas reportadas|Berichtete Vorteile|Vantagens relatadas|報告された利点|报告的优势|Отмеченные преимущества
Reported complaints|Quejas reportadas|Berichtete Beschwerden|Reclamações relatadas|報告された不満|报告的投诉|Зафиксированные жалобы
Key name|Nombre de clave|Schlüsselname|Nome da chave|キー名|密钥名称|Название ключа
Intelligence reports|Informes de análisis|Analyseberichte|Relatórios de análise|分析レポート|分析报告|Аналитические отчёты
Shared watchlist|Lista compartida|Gemeinsame Merkliste|Lista compartilhada|共有ウォッチリスト|共享关注列表|Общее избранное
Client radars|Radares de clientes|Kundenradare|Radares de clientes|顧客レーダー|客户雷达|Радары клиентов
Edit radar|Editar radar|Radar bearbeiten|Editar radar|レーダーを編集|编辑雷达|Изменить радар
Client reports|Informes de clientes|Kundenberichte|Relatórios de clientes|顧客レポート|客户报告|Отчёты клиентов
Workspace API keys|Claves API del espacio|API-Schlüssel des Arbeitsbereichs|Chaves API do espaço|ワークスペースのAPIキー|工作区API密钥|API-ключи пространства
Outbound webhooks|Webhooks salientes|Ausgehende Webhooks|Webhooks de saída|送信Webhook|出站Webhook|Исходящие вебхуки
Recent deliveries|Entregas recientes|Letzte Zustellungen|Entregas recentes|最近の配信|最近的发送|Последние доставки
Branding|Identidad de marca|Markenauftritt|Identidade da marca|ブランディング|品牌设置|Брендинг
Assign team members|Asignar miembros|Teammitglieder zuweisen|Atribuir membros|メンバーを割り当て|分配团队成员|Назначить участников
Subscription|Suscripción|Abonnement|Assinatura|サブスクリプション|订阅|Подписка
Invoices|Facturas|Rechnungen|Faturas|請求書|发票|Счета
Teams & client workspaces|Equipos y espacios de clientes|Teams und Kundenbereiche|Equipes e espaços de clientes|チームと顧客ワークスペース|团队与客户工作区|Команды и пространства клиентов
Create a client workspace|Crear espacio de cliente|Kundenbereich erstellen|Criar espaço de cliente|顧客ワークスペースを作成|创建客户工作区|Создать пространство клиента
Invite a team member|Invitar miembro|Teammitglied einladen|Convidar membro|メンバーを招待|邀请团队成员|Пригласить участника
Members|Miembros|Mitglieder|Membros|メンバー|成员|Участники
Pending invitations|Invitaciones pendientes|Offene Einladungen|Convites pendentes|未承諾の招待|待处理邀请|Ожидающие приглашения
Create your agency team|Crear equipo de agencia|Agenturteam erstellen|Criar equipe da agência|エージェンシーチームを作成|创建机构团队|Создать команду агентства
Something went wrong|Algo salió mal|Etwas ist schiefgelaufen|Algo deu errado|問題が発生しました|出现了问题|Что-то пошло не так
Custom radars|Radares personalizados|Eigene Radare|Radares personalizados|カスタムレーダー|自定义雷达|Персональные радары
Create a radar|Crear un radar|Einen Radar erstellen|Criar um radar|レーダーを作成|创建雷达|Создать радар
Trending opportunities|Oportunidades en tendencia|Chancen im Trend|Oportunidades em tendência|トレンドの機会|热门机会|Популярные возможности
Join an agency team|Unirse a un equipo|Einem Agenturteam beitreten|Entrar em uma equipe|エージェンシーチームに参加|加入机构团队|Присоединиться к команде
The problem|El problema|Das Problem|O problema|課題|问题|Проблема
Who experiences it?|¿A quién afecta?|Wer ist betroffen?|Quem enfrenta isso?|誰が経験していますか？|谁会遇到它？|Кто сталкивается с этим?
Observed growth|Crecimiento observado|Beobachtetes Wachstum|Crescimento observado|観測された成長|已观察增长|Наблюдаемый рост
Evidence|Evidencia|Belege|Evidências|証拠|证据|Подтверждения
Commercial intent|Intención comercial|Kommerzielle Absicht|Intenção comercial|商業的な意図|商业意图|Коммерческий интерес
Existing workarounds|Soluciones alternativas|Bestehende Umgehungslösungen|Soluções alternativas|既存の回避策|现有变通方案|Способы обхода проблемы
Existing solutions|Soluciones existentes|Bestehende Lösungen|Soluções existentes|既存の解決策|现有解决方案|Существующие решения
Market gap|Vacío de mercado|Marktlücke|Lacuna de mercado|市場のギャップ|市场缺口|Пробел на рынке
Score breakdown|Desglose de puntuación|Bewertungsübersicht|Detalhamento da pontuação|スコアの内訳|评分明细|Состав оценки
Your first MVP|Tu primer MVP|Ihr erstes MVP|Seu primeiro MVP|最初のMVP|您的首个MVP|Ваш первый MVP
Source distribution|Distribución de fuentes|Quellenverteilung|Distribuição de fontes|ソース分布|来源分布|Распределение источников
Risks|Riesgos|Risiken|Riscos|リスク|风险|Риски
Data maintenance|Mantenimiento de datos|Datenpflege|Manutenção de dados|データ保守|数据维护|Обслуживание данных
Source & crawler health|Estado de fuentes y recopiladores|Zustand der Quellen und Crawler|Estado das fontes e coletores|ソースとクローラーの状態|来源和采集器状态|Состояние источников и сборщиков
Publication queue|Cola de publicación|Veröffentlichungswarteschlange|Fila de publicação|公開キュー|发布队列|Очередь публикации
Job runs|Ejecuciones|Auftragsläufe|Execuções|実行履歴|任务运行|Запуски заданий
Recent users|Usuarios recientes|Letzte Benutzer|Usuários recentes|最近のユーザー|最近用户|Последние пользователи
Recently updated subscriptions|Suscripciones actualizadas|Zuletzt aktualisierte Abonnements|Assinaturas atualizadas|最近更新されたサブスクリプション|最近更新的订阅|Обновлённые подписки
Stripe reconciliation|Conciliación de Stripe|Stripe-Abgleich|Conciliação do Stripe|Stripeの照合|Stripe核对|Сверка Stripe
Invoice recovery|Recuperación de facturas|Rechnungswiederherstellung|Recuperação de faturas|請求書の復旧|发票恢复|Восстановление счетов
Recent subscription observations|Observaciones de suscripción|Letzte Abonnement-Beobachtungen|Observações de assinaturas|最近のサブスクリプション記録|最近订阅记录|Последние события подписок
Nothing on the radar here.|Nada en el radar aquí.|Hier ist noch nichts auf dem Radar.|Nada no radar aqui.|ここにはまだ何もありません。|雷达上暂无内容。|Здесь пока пусто.
Invest in the right problem.|Invierte en el problema correcto.|Investieren Sie in das richtige Problem.|Invista no problema certo.|解くべき課題に投資を。|投资于正确的问题。|Вкладывайтесь в правильную проблему.
Pre-launch terms|Términos previos al lanzamiento|Bedingungen vor dem Start|Termos de pré-lançamento|公開前の利用条件|发布前条款|Условия до запуска
Verify your email.|Verifica tu correo.|Bestätigen Sie Ihre E-Mail.|Verifique seu e-mail.|メールを確認してください。|验证您的邮箱。|Подтвердите почту.
Read the evidence.|Lee la evidencia.|Lesen Sie die Belege.|Leia as evidências.|証拠を読む。|阅读证据。|Изучите подтверждения.
Let the evidence lead.|Deja que la evidencia guíe.|Lassen Sie Belege entscheiden.|Deixe as evidências guiarem.|証拠を指針に。|让证据引领。|Опирайтесь на факты.
From interesting to actionable.|De interesante a práctico.|Von interessant zu umsetzbar.|De interessante a acionável.|興味から行動へ。|从兴趣到行动。|От интереса к действию.
Good questions.|Buenas preguntas.|Gute Fragen.|Boas perguntas.|よくある質問。|常见问题。|Хорошие вопросы.
Build with conviction.|Construye con certeza.|Mit Überzeugung entwickeln.|Crie com confiança.|確信を持って作る。|充满信心地构建。|Создавайте уверенно.
Saving…|Guardando…|Speichern…|Salvando…|保存中…|保存中…|Сохранение…
Save source configuration|Guardar configuración de fuente|Quellenkonfiguration speichern|Salvar configuração da fonte|ソース設定を保存|保存来源配置|Сохранить настройки источника
Source configured.|Fuente configurada.|Quelle konfiguriert.|Fonte configurada.|ソースを設定しました。|来源已配置。|Источник настроен.
A collection run is already active. Follow its progress before starting another.|Ya hay un proceso activo. Sigue su progreso antes de iniciar otro.|Ein Lauf ist bereits aktiv. Verfolgen Sie den Fortschritt, bevor Sie einen weiteren starten.|Já há uma execução ativa. Acompanhe o progresso antes de iniciar outra.|収集は実行中です。次の実行前に進捗を確認してください。|已有采集任务正在运行，请等待完成后再启动。|Сбор уже выполняется. Следите за прогрессом перед новым запуском.
Processing failed. Review the job in Inngest before restarting.|El proceso falló. Revisa la tarea en Inngest antes de reiniciar.|Verarbeitung fehlgeschlagen. Prüfen Sie den Auftrag in Inngest vor einem Neustart.|O processamento falhou. Revise a tarefa no Inngest antes de reiniciar.|処理に失敗しました。再開前にInngestのジョブを確認してください。|处理失败，请先在Inngest检查任务再重新启动。|Обработка завершилась ошибкой. Проверьте задание в Inngest перед повтором.
Embeddings per batch|Embeddings por lote|Embeddings pro Durchlauf|Embeddings por lote|バッチごとの埋め込み|每批嵌入数|Векторов за запуск
Signals waiting for related evidence|Señales que esperan evidencia relacionada|Signale warten auf ähnliche Belege|Sinais aguardando evidências relacionadas|関連する証拠を待つシグナル|等待相关证据的信号|Сигналы ожидают похожих подтверждений
YOUR INTELLIGENCE WORKSPACE|TU ESPACIO DE INTELIGENCIA|IHR ANALYSEBEREICH|SEU ESPAÇO DE INTELIGÊNCIA|インサイトのワークスペース|您的情报工作区|ВАШЕ ПРОСТРАНСТВО АНАЛИТИКИ
Create your free PainRadar account.|Crea tu cuenta gratuita de PainRadar.|Erstellen Sie Ihr kostenloses PainRadar-Konto.|Crie sua conta gratuita no PainRadar.|無料のPainRadarアカウントを作成します。|创建免费PainRadar账户。|Создайте бесплатный аккаунт PainRadar.
Evidence first. Your next opportunity awaits.|Evidencia primero. Tu próxima oportunidad te espera.|Belege zuerst. Ihre nächste Chance wartet.|Evidências primeiro. Sua próxima oportunidade espera.|証拠を重視して、次の機会を探しましょう。|证据优先，下一个机会等待您。|Сначала факты. Ваша следующая возможность уже ждёт.
Please wait…|Espera…|Bitte warten…|Aguarde…|お待ちください…|请稍候…|Подождите…
Create free account|Crear cuenta gratuita|Kostenloses Konto erstellen|Criar conta gratuita|無料アカウントを作成|创建免费账户|Создать бесплатный аккаунт
Send reset link|Enviar enlace de recuperación|Link zum Zurücksetzen senden|Enviar link de redefinição|再設定リンクを送信|发送重置链接|Отправить ссылку для сброса
Reset password|Restablecer contraseña|Passwort zurücksetzen|Redefinir senha|パスワードを再設定|重置密码|Сбросить пароль
Check your email to verify your account.|Revisa tu correo para verificar tu cuenta.|Prüfen Sie Ihre E-Mail zur Kontobestätigung.|Verifique seu e-mail para confirmar a conta.|メールを確認してアカウントを認証してください。|请查看邮件以验证账户。|Проверьте почту для подтверждения аккаунта.
If an account exists, a reset link will be sent.|Si existe la cuenta, recibirás un enlace.|Falls das Konto existiert, wird ein Link gesendet.|Se a conta existir, um link será enviado.|アカウントが存在する場合、リンクを送信します。|如果账户存在，将发送重置链接。|Если аккаунт существует, мы отправим ссылку для сброса.
Your password has been reset. You can now log in.|Tu contraseña se ha restablecido. Puedes iniciar sesión.|Ihr Passwort wurde zurückgesetzt. Sie können sich anmelden.|Sua senha foi redefinida. Você pode entrar.|パスワードを再設定しました。ログインできます。|密码已重置，现在可以登录。|Пароль изменён. Теперь можно войти.
Languages|Idiomas|Sprachen|Idiomas|言語|语言|Языки
Daily|Diario|Täglich|Diário|毎日|每天|Ежедневно
Weekly|Semanal|Wöchentlich|Semanal|毎週|每周|Еженедельно
English|Inglés|Englisch|Inglês|英語|英语|Английский
Spanish|Español|Spanisch|Espanhol|スペイン語|西班牙语|Испанский
German|Alemán|Deutsch|Alemão|ドイツ語|德语|Немецкий
Portuguese|Portugués|Portugiesisch|Português|ポルトガル語|葡萄牙语|Португальский
Japanese|Japonés|Japanisch|Japonês|日本語|日语|Японский
Chinese|Chino|Chinesisch|Chinês|中国語|中文|Китайский
Russian|Ruso|Russisch|Russo|ロシア語|俄语|Русский
Open navigation|Abrir navegación|Navigation öffnen|Abrir navegação|メニューを開く|打开导航|Открыть меню
Close navigation|Cerrar navegación|Navigation schließen|Fechar navegação|メニューを閉じる|关闭导航|Закрыть меню
Search opportunities|Buscar oportunidades|Chancen suchen|Buscar oportunidades|機会を検索|搜索机会|Найти возможности
Public stories and comments through the Algolia API.|Historias y comentarios públicos mediante Algolia.|Öffentliche Beiträge und Kommentare über Algolia.|Publicações e comentários públicos pelo Algolia.|Algoliaから公開記事とコメントを収集します。|通过Algolia采集公开文章和评论。|Публичные публикации и комментарии через Algolia.
Public issues in explicitly configured repositories.|Incidencias públicas en los repositorios configurados.|Öffentliche Issues in den konfigurierten Repositories.|Issues públicas nos repositórios configurados.|設定したリポジトリの公開Issueを収集します。|采集已配置仓库的公开Issue。|Публичные обсуждения в указанных репозиториях.
Public posts in configured communities, using authorized Reddit API access.|Publicaciones de comunidades configuradas con acceso autorizado a Reddit.|Öffentliche Beiträge konfigurierter Communities mit autorisiertem Reddit-Zugriff.|Publicações nas comunidades configuradas com acesso autorizado ao Reddit.|認可されたReddit APIで設定コミュニティの投稿を収集します。|通过授权的Reddit API采集指定社区的公开帖子。|Публичные посты выбранных сообществ через авторизованный API Reddit.
Collection is managed by the administrator. No private data is collected.|El administrador gestiona la recopilación. No se recopilan datos privados.|Der Administrator verwaltet die Sammlung. Private Daten werden nicht erfasst.|A coleta é gerenciada pelo administrador. Dados privados não são coletados.|収集は管理者が管理します。非公開データは収集しません。|采集由管理员管理，不采集私密数据。|Сбором управляет администратор. Приватные данные не собираются.
Changing configuration restarts collection for the new scopes. Existing records are deduplicated.|Cambiar la configuración reinicia la recopilación para las nuevas fuentes. Se eliminan duplicados.|Konfigurationsänderungen starten die Sammlung neu. Bestehende Daten werden dedupliziert.|Alterar a configuração reinicia a coleta. Registros existentes são deduplicados.|設定を変更すると収集を再開し、既存データの重複を除去します。|修改配置后重新开始采集，并对现有记录去重。|Изменение настроек перезапускает сбор по новым параметрам. Дубликаты исключаются.
Unfinished collection resumes on the next run. Provider listing limits still apply.|La recopilación pendiente continúa en la siguiente ejecución. Se aplican los límites del proveedor.|Unvollständige Sammlung wird beim nächsten Lauf fortgesetzt. Anbieterlimits gelten weiterhin.|A coleta incompleta continua na próxima execução. Os limites do provedor se aplicam.|未完了の収集は次回に続行します。提供元の制限が適用されます。|未完成的采集在下次任务继续，仍受提供方限制。|Незавершённый сбор продолжится при следующем запуске. Лимиты источников сохраняются.
Collection reads up to 100 records per page, with a configured page budget and saved continuation between runs. Provider search/listing limits still apply. Source coverage is partial and does not represent the whole market.|Se leen hasta 100 registros por página. El progreso se guarda entre ejecuciones. Se aplican límites del proveedor y la cobertura es parcial.|Bis zu 100 Datensätze pro Seite. Der Fortschritt bleibt gespeichert. Anbieterlimits gelten; die Abdeckung ist unvollständig.|São lidos até 100 registros por página. O progresso é salvo entre execuções. A cobertura é parcial e os limites do provedor se aplicam.|1ページ最大100件を収集し、進捗を保存します。提供元の制限があり、市場全体を網羅しません。|每页最多采集100条，保存进度供下次继续。受提供方限制，不能代表整个市场。|До 100 записей на страницу. Прогресс сохраняется между запусками. Действуют лимиты источников; охват не отражает весь рынок.
Source request failed. Check access and configuration.|Falló la consulta de la fuente. Revisa el acceso y la configuración.|Quellenanfrage fehlgeschlagen. Prüfen Sie Zugriff und Konfiguration.|Falha na fonte. Verifique o acesso e a configuração.|ソースの取得に失敗しました。アクセスと設定を確認してください。|来源请求失败，请检查访问权限和配置。|Ошибка запроса к источнику. Проверьте доступ и настройки.
GROWTH, NOT GUESSWORK|CRECIMIENTO SIN SUPOSICIONES|WACHSTUM STATT VERMUTUNGEN|CRESCIMENTO SEM SUPOSIÇÕES|成長をデータで確認|用数据衡量增长|РОСТ НА ОСНОВЕ ФАКТОВ
FRESH ON THE RADAR|NUEVO EN EL RADAR|NEU AUF DEM RADAR|NOVO NO RADAR|新しいシグナル|雷达新发现|НОВОЕ НА РАДАРЕ
Growth: not enough history|Crecimiento: historial insuficiente|Wachstum: zu wenig Historie|Crescimento: histórico insuficiente|成長：履歴が不足しています|增长：历史数据不足|Рост: недостаточно истории
confidence|confianza|Konfidenz|confiança|確信度|置信度|уверенность
since viewed|desde la última vista|seit dem letzten Aufruf|desde a última visualização|前回閲覧から|自上次查看|с прошлого просмотра
Welcome back.|Bienvenido de nuevo.|Willkommen zurück.|Bem-vindo de volta.|おかえりなさい。|欢迎回来。|С возвращением.
Start finding real problems.|Empieza a encontrar problemas reales.|Finden Sie echte Probleme.|Comece a encontrar problemas reais.|実際の課題を見つけましょう。|开始发现真实问题。|Находите реальные проблемы.
Reset your password.|Restablece tu contraseña.|Setzen Sie Ihr Passwort zurück.|Redefina sua senha.|パスワードを再設定します。|重置您的密码。|Сбросьте пароль.
Choose a new password.|Elige una nueva contraseña.|Wählen Sie ein neues Passwort.|Escolha uma nova senha.|新しいパスワードを選択してください。|设置新密码。|Выберите новый пароль.
Free-tier runs pause between AI requests; this may take several minutes.|El plan gratuito pausa entre solicitudes; puede tardar varios minutos.|Im kostenlosen Tarif gibt es Pausen zwischen KI-Anfragen; der Lauf kann mehrere Minuten dauern.|O plano gratuito pausa entre solicitações; pode levar vários minutos.|無料プランではAIリクエスト間に待機するため、数分かかります。|免费方案会在AI请求之间暂停，可能需要几分钟。|На бесплатном тарифе между запросами к ИИ есть паузы. Обработка может занять несколько минут.
Complete the Gemini and background job setup in Admin to enable collection.|Completa la configuración de Gemini y las tareas en Administración.|Richten Sie Gemini und Hintergrundjobs im Adminbereich ein.|Configure o Gemini e as tarefas na Administração.|管理画面でGeminiとバックグラウンドジョブを設定してください。|请在管理页面完成Gemini和后台任务配置。|Настройте Gemini и фоновые задания в админке, чтобы включить сбор.
WHERE THE SIGNAL IS GETTING LOUDER|DÓNDE CRECEN LAS SEÑALES|WO SIGNALE STÄRKER WERDEN|ONDE OS SINAIS CRESCEM|シグナルが強まる分野|信号正在增强的领域|ГДЕ УСИЛИВАЮТСЯ СИГНАЛЫ
Ranked by evidence. Growth measured against prior periods.|Clasificadas por evidencia. Crecimiento respecto a períodos anteriores.|Nach Belegen geordnet. Wachstum im Vergleich zu früheren Zeiträumen.|Ordenadas por evidências. Crescimento em relação a períodos anteriores.|証拠に基づいて並べ、過去期間と成長を比較します。|按证据排序，增长与历史周期比较。|Рейтинг на основе фактов. Рост относительно предыдущих периодов.
Export CSV ↗|Exportar CSV ↗|CSV exportieren ↗|Exportar CSV ↗|CSVを出力 ↗|导出CSV ↗|Экспорт CSV ↗
Search|Buscar|Suchen|Buscar|検索|搜索|Поиск
Search a problem or audience|Buscar un problema o público|Problem oder Zielgruppe suchen|Buscar problema ou público|課題や対象者を検索|搜索问题或受众|Поиск проблемы или аудитории
Any industry|Cualquier sector|Alle Branchen|Qualquer setor|すべての業界|所有行业|Любая отрасль
All sources|Todas las fuentes|Alle Quellen|Todas as fontes|すべてのソース|所有来源|Все источники
All confidence levels|Todos los niveles de confianza|Alle Konfidenzstufen|Todos os níveis de confiança|すべての確信度|所有置信度|Любая уверенность
Low|Baja|Niedrig|Baixa|低|低|Низкая
Medium|Media|Mittel|Média|中|中|Средняя
High|Alta|Hoch|Alta|高|高|Высокая
Any score|Cualquier puntuación|Alle Bewertungen|Qualquer pontuação|すべてのスコア|所有评分|Любая оценка
Score 40+|Puntuación 40+|Bewertung 40+|Pontuação 40+|スコア40以上|评分40以上|Оценка 40+
Score 60+|Puntuación 60+|Bewertung 60+|Pontuação 60+|スコア60以上|评分60以上|Оценка 60+
Score 80+|Puntuación 80+|Bewertung 80+|Pontuação 80+|スコア80以上|评分80以上|Оценка 80+
All time|Todo el tiempo|Gesamter Zeitraum|Todo o período|全期間|全部时间|За всё время
Last 7 days|Últimos 7 días|Letzte 7 Tage|Últimos 7 dias|過去7日|最近7天|Последние 7 дней
Last 30 days|Últimos 30 días|Letzte 30 Tage|Últimos 30 dias|過去30日|最近30天|Последние 30 дней
Last 90 days|Últimos 90 días|Letzte 90 Tage|Últimos 90 dias|過去90日|最近90天|Последние 90 дней
Any audience|Cualquier público|Alle Zielgruppen|Qualquer público|すべての対象者|所有受众|Любая аудитория
All languages|Todos los idiomas|Alle Sprachen|Todos os idiomas|すべての言語|所有语言|Все языки
Min. 7d growth %|Crecimiento mín. 7 días %|Min. Wachstum 7 Tage %|Crescimento mín. 7 dias %|7日間の最小成長率%|7天最低增长率%|Мин. рост за 7 дней, %
Any competition data|Cualquier dato de competencia|Alle Wettbewerbsdaten|Qualquer dado de concorrência|すべての競合データ|所有竞争数据|Любые данные о конкуренции
Verified competition gap only|Solo brechas de competencia verificadas|Nur verifizierte Wettbewerbslücken|Apenas lacunas de concorrência verificadas|確認済みの競合余地のみ|仅已验证的竞争空白|Только подтверждённые пробелы в конкуренции
Apply filters|Aplicar filtros|Filter anwenden|Aplicar filtros|フィルターを適用|应用筛选|Применить фильтры
Reset|Restablecer|Zurücksetzen|Redefinir|リセット|重置|Сбросить
Save opportunity|Guardar oportunidad|Chance speichern|Salvar oportunidade|機会を保存|保存机会|Сохранить возможность
Saved|Guardada|Gespeichert|Salva|保存済み|已保存|Сохранено
Sources|Fuentes|Quellen|Fontes|ソース|来源|Источники
The database is not configured.|La base de datos no está configurada.|Die Datenbank ist nicht konfiguriert.|O banco de dados não está configurado.|データベースが未設定です。|数据库尚未配置。|База данных не настроена.
No sources have been configured yet. Collection has not started.|No hay fuentes configuradas. La recopilación no ha comenzado.|Es sind keine Quellen konfiguriert. Die Sammlung hat nicht begonnen.|Não há fontes configuradas. A coleta não começou.|ソースが未設定で、収集は開始していません。|尚未配置来源，采集未开始。|Источники ещё не настроены. Сбор не начат.
Source configuration is saved.|La configuración está guardada.|Die Quellenkonfiguration wurde gespeichert.|A configuração foi salva.|ソース設定を保存しました。|来源配置已保存。|Настройки источников сохранены.
Background job keys are configured; the job service must also be connected to this app.|Las claves están configuradas; conecta también el servicio de tareas a esta aplicación.|Schlüssel sind konfiguriert; verbinden Sie auch den Jobdienst mit der App.|As chaves estão configuradas; conecte também o serviço de tarefas ao app.|キーは設定済みです。ジョブサービスもアプリに接続してください。|密钥已配置，还需将任务服务连接至此应用。|Ключи фоновых заданий настроены. Сервис заданий также должен быть подключён к приложению.
Background collection is not configured. The administrator must connect Inngest and configure its event and signing keys.|La recopilación no está configurada. El administrador debe conectar Inngest y sus claves.|Hintergrundsammlung ist nicht konfiguriert. Der Administrator muss Inngest und die Schlüssel einrichten.|A coleta não está configurada. O administrador deve conectar o Inngest e suas chaves.|管理者がInngestとイベント・署名キーを設定する必要があります。|后台采集未配置，管理员需连接Inngest并设置密钥。|Фоновый сбор не настроен. Администратору нужно подключить Inngest и его ключи.
AI analysis is not configured. The administrator must configure Gemini before opportunities can be analyzed.|El análisis IA no está configurado. El administrador debe configurar Gemini.|KI-Analyse ist nicht konfiguriert. Der Administrator muss Gemini einrichten.|A análise IA não está configurada. O administrador deve configurar o Gemini.|AI分析は未設定です。管理者がGeminiを設定してください。|AI分析未配置，管理员需先配置Gemini。|ИИ-анализ не настроен. Администратору нужно настроить Gemini.
Configure sources in Admin →|Configurar fuentes en Administración →|Quellen im Adminbereich konfigurieren →|Configurar fontes na Administração →|管理画面でソースを設定 →|在管理页配置来源 →|Настроить источники в админке →
Ask your administrator to complete setup and start the first collection.|Pide al administrador que complete la configuración e inicie la recopilación.|Bitten Sie den Administrator, die Einrichtung abzuschließen und die Sammlung zu starten.|Peça ao administrador para configurar e iniciar a coleta.|管理者に設定と最初の収集を依頼してください。|请管理员完成配置并启动首次采集。|Попросите администратора завершить настройку и запустить первый сбор.
Data services are not connected yet. This workspace contains no simulated opportunities. Connect PostgreSQL and configure source collection to start.|Los servicios de datos no están conectados. Conecta PostgreSQL y configura las fuentes para empezar.|Datendienste sind noch nicht verbunden. Verbinden Sie PostgreSQL und konfigurieren Sie die Sammlung.|Os serviços de dados não estão conectados. Conecte o PostgreSQL e configure as fontes.|データサービスは未接続です。PostgreSQLとソース収集を設定してください。|数据服务尚未连接，请连接PostgreSQL并配置采集来源。|Сервисы данных ещё не подключены. Подключите PostgreSQL и настройте сбор источников. Демонстрационных результатов здесь нет.
Sign-in is not configured yet. Contact the administrator.|El inicio de sesión no está configurado. Contacta al administrador.|Die Anmeldung ist noch nicht konfiguriert. Kontaktieren Sie den Administrator.|O login não está configurado. Contate o administrador.|ログインは未設定です。管理者に連絡してください。|登录尚未配置，请联系管理员。|Вход ещё не настроен. Обратитесь к администратору.
EVERY INSIGHT HAS A PAPER TRAIL|CADA HALLAZGO TIENE PRUEBAS|JEDE ERKENNTNIS IST BELEGT|TODO INSIGHT TEM EVIDÊNCIAS|すべての知見に証拠を|每个洞察都有依据|КАЖДЫЙ ВЫВОД ИМЕЕТ ПОДТВЕРЖДЕНИЕ
Then make your move.|Después actúa.|Dann handeln Sie.|Depois aja.|そして行動へ。|然后采取行动。|Затем действуйте.
EVIDENCE FEED|EVIDENCIAS|BELEGE|EVIDÊNCIAS|証拠フィード|证据列表|ЛЕНТА ПОДТВЕРЖДЕНИЙ
Live data only|Solo datos reales|Nur echte Daten|Apenas dados reais|実データのみ|仅真实数据|Только реальные данные
No claims without sources|Sin afirmaciones sin fuentes|Keine Aussagen ohne Quellen|Sem afirmações sem fontes|出典のない主張はしません|无来源不下结论|Без источников нет выводов
BUILT FOR YOUR WORKFLOW|PARA TU FLUJO DE TRABAJO|FÜR IHREN ARBEITSABLAUF|PARA SEU FLUXO DE TRABALHO|あなたの作業に合わせて|为您的工作流程而建|ДЛЯ ВАШЕГО РАБОЧЕГО ПРОЦЕССА
YOUR NEXT BUILD STARTS HERE|TU PRÓXIMO PROYECTO EMPIEZA AQUÍ|IHR NÄCHSTES PROJEKT BEGINNT HIER|SEU PRÓXIMO PROJETO COMEÇA AQUI|次の開発はここから|下一个项目从这里开始|ВАШ СЛЕДУЮЩИЙ ПРОЕКТ НАЧИНАЕТСЯ ЗДЕСЬ
Start your radar|Inicia tu radar|Starten Sie Ihr Radar|Inicie seu radar|レーダーを始める|启动您的雷达|Запустите свой радар
Start free →|Empezar gratis →|Kostenlos starten →|Começar grátis →|無料で始める →|免费开始 →|Начать бесплатно →
Set up your first radar →|Configura tu primer radar →|Ihr erstes Radar einrichten →|Configure seu primeiro radar →|最初のレーダーを設定 →|设置第一个雷达 →|Настройте первый радар →
Watch demand grow|Observa crecer la demanda|Nachfragewachstum verfolgen|Veja a demanda crescer|需要の成長を追跡|关注需求增长|Следите за ростом спроса
Opportunity watchlists|Listas de oportunidades|Chancen-Merklisten|Listas de oportunidades|機会のウォッチリスト|机会关注列表|Списки возможностей
Transparent scoring|Puntuación transparente|Transparente Bewertung|Pontuação transparente|透明な評価|透明评分|Прозрачные оценки
Daily intelligence|Información diaria|Tägliche Erkenntnisse|Informações diárias|毎日のインサイト|每日情报|Ежедневная аналитика
LESS GUESSWORK AT EVERY STAGE|MENOS SUPOSICIONES EN CADA ETAPA|WENIGER VERMUTUNGEN IN JEDER PHASE|MENOS SUPOSIÇÕES EM CADA ETAPA|各段階で推測を減らす|每个阶段减少猜测|МЕНЬШЕ ДОГАДОК НА КАЖДОМ ЭТАПЕ
Start free. Go deeper when you find your direction.|Empieza gratis. Profundiza cuando encuentres tu dirección.|Kostenlos starten. Vertiefen, wenn Ihre Richtung feststeht.|Comece grátis. Aprofunde quando encontrar seu caminho.|無料で始め、方向性が見えたら深掘りしましょう。|免费开始，找到方向后深入探索。|Начните бесплатно. Расширяйте возможности, когда выберете направление.
per month|por mes|pro Monat|por mês|月額|每月|в месяц
Opening…|Abriendo…|Wird geöffnet…|Abrindo…|開いています…|正在打开…|Открываем…
Manage subscription|Gestionar suscripción|Abonnement verwalten|Gerenciar assinatura|サブスクリプションを管理|管理订阅|Управлять подпиской
Choose|Elegir|Wählen|Escolher|選択|选择|Выбрать
ORIGINAL CONVERSATIONS|CONVERSACIONES ORIGINALES|ORIGINALE DISKUSSIONEN|CONVERSAS ORIGINAIS|元の会話|原始讨论|ИСХОДНЫЕ ОБСУЖДЕНИЯ
Read the original discussions and follow how each signal is processed.|Lee las discusiones originales y sigue el procesamiento.|Lesen Sie Originaldiskussionen und verfolgen Sie die Verarbeitung.|Leia as discussões originais e acompanhe o processamento.|元の会話を読み、処理状況を確認できます。|阅读原始讨论并查看处理状态。|Открывайте исходные обсуждения и следите за обработкой сигналов.
Search signals|Buscar señales|Signale suchen|Buscar sinais|シグナルを検索|搜索信号|Поиск сигналов
Processing state|Estado de procesamiento|Verarbeitungsstatus|Estado do processamento|処理状況|处理状态|Состояние обработки
All processing states|Todos los estados|Alle Status|Todos os estados|すべての状態|所有状态|Любое состояние
Waiting for AI processing|Esperando el procesamiento IA|Wartet auf KI-Verarbeitung|Aguardando processamento IA|AI処理待ち|等待AI处理|Ожидает обработки ИИ
Waiting for related evidence|Esperando evidencia relacionada|Wartet auf ähnliche Belege|Aguardando evidências relacionadas|関連する証拠を待っています|等待相关证据|Ожидает похожих подтверждений
Reviewed|Revisada|Geprüft|Revisado|確認済み|已审查|Проверен
Duplicate|Duplicada|Duplikat|Duplicado|重複|重复|Дубликат
A collected signal is evidence, not a validated opportunity.|Una señal es evidencia; la oportunidad requiere validación.|Ein Signal ist ein Beleg; eine Chance benötigt Validierung.|Um sinal é uma evidência; a oportunidade exige validação.|シグナルは証拠であり、機会には検証が必要です。|信号是证据，机会需要验证。|Собранный сигнал — подтверждение. Возможность требует отдельной проверки.
Read original discussion|Leer discusión original|Originaldiskussion lesen|Ler discussão original|元の会話を読む|阅读原始讨论|Открыть обсуждение
No signals match these filters.|No hay señales con estos filtros.|Keine Signale passen zu diesen Filtern.|Nenhum sinal corresponde aos filtros.|条件に合うシグナルはありません。|没有符合筛选的信号。|По этим фильтрам сигналов нет.
Try another source or search phrase.|Prueba otra fuente o búsqueda.|Versuchen Sie eine andere Quelle oder Suche.|Tente outra fonte ou pesquisa.|別のソースや検索語を試してください。|尝试其他来源或关键词。|Выберите другой источник или поисковый запрос.
Connect source collection to see original signals here.|Conecta las fuentes para ver señales aquí.|Verbinden Sie Quellen, um Signale zu sehen.|Conecte as fontes para ver sinais aqui.|ソース収集を設定すると表示されます。|配置来源采集后即可查看信号。|Настройте сбор источников, чтобы увидеть исходные сигналы.
Signal pages|Páginas de señales|Signalseiten|Páginas de sinais|シグナルのページ|信号分页|Страницы сигналов
Previous|Anterior|Zurück|Anterior|前へ|上一页|Назад
Next|Siguiente|Weiter|Próxima|次へ|下一页|Далее
Page|Página|Seite|Página|ページ|页|Страница
Browse all signals →|Ver todas las señales →|Alle Signale ansehen →|Ver todos os sinais →|すべてのシグナルを見る →|查看所有信号 →|Посмотреть все сигналы →
Gemini quota reached. Wait for the quota to renew, then continue processing.|Se alcanzó la cuota de Gemini. Espera a que se renueve para continuar.|Gemini-Kontingent erreicht. Warten Sie auf die Erneuerung und fahren Sie fort.|Cota do Gemini atingida. Aguarde a renovação para continuar.|Geminiの上限に達しました。更新後に処理を続けてください。|Gemini额度已用尽，刷新后继续处理。|Достигнут лимит Gemini. Дождитесь обновления квоты и продолжите обработку.
Gemini is not configured. Ask the administrator to finish AI setup.|Gemini no está configurado. Pide al administrador que lo configure.|Gemini ist nicht konfiguriert. Bitten Sie den Administrator um Einrichtung.|Gemini não está configurado. Peça ao administrador para configurar.|Geminiが未設定です。管理者に設定を依頼してください。|Gemini未配置，请管理员完成设置。|Gemini не настроен. Попросите администратора завершить настройку ИИ.
Gemini access was rejected. The administrator should check the API key and model access.|Gemini rechazó el acceso. El administrador debe revisar la clave y el modelo.|Gemini-Zugriff abgelehnt. Prüfen Sie API-Schlüssel und Modellzugriff.|Acesso ao Gemini rejeitado. Verifique a chave e o acesso ao modelo.|Geminiへのアクセスが拒否されました。管理者がキーとモデルを確認してください。|Gemini拒绝访问，管理员应检查密钥和模型权限。|Gemini отклонил доступ. Администратору нужно проверить ключ и доступ к модели.
The selected Gemini model is unavailable. Check the model configuration.|El modelo Gemini no está disponible. Revisa su configuración.|Das gewählte Gemini-Modell ist nicht verfügbar. Prüfen Sie die Konfiguration.|O modelo Gemini está indisponível. Verifique a configuração.|選択したGeminiモデルが利用できません。設定を確認してください。|所选Gemini模型不可用，请检查配置。|Выбранная модель Gemini недоступна. Проверьте настройки модели.
Gemini is temporarily unavailable. Try processing again later.|Gemini no está disponible temporalmente. Inténtalo más tarde.|Gemini ist vorübergehend nicht verfügbar. Versuchen Sie es später.|Gemini está temporariamente indisponível. Tente novamente depois.|Geminiは一時的に利用できません。後で再試行してください。|Gemini暂时不可用，请稍后重试。|Gemini временно недоступен. Повторите обработку позже.
Copy this value now:|Copia este valor ahora:|Kopieren Sie diesen Wert jetzt:|Copie este valor agora:|この値をコピーしてください：|请立即复制此值：|Скопируйте значение сейчас:
Sending…|Enviando…|Wird gesendet…|Enviando…|送信中…|发送中…|Отправляем…
Send verification link|Enviar enlace de verificación|Bestätigungslink senden|Enviar link de verificação|認証リンクを送信|发送验证链接|Отправить ссылку подтверждения
If your account needs verification, a link will be sent.|Si tu cuenta necesita verificación, recibirás un enlace.|Falls Ihr Konto eine Bestätigung benötigt, wird ein Link gesendet.|Se a conta precisar de verificação, um link será enviado.|認証が必要な場合、リンクを送信します。|如账户需要验证，将发送链接。|Если аккаунту нужно подтверждение, мы отправим ссылку.
Creating…|Creando…|Wird erstellt…|Criando…|作成中…|创建中…|Создаём…
Create API key|Crear clave API|API-Schlüssel erstellen|Criar chave API|APIキーを作成|创建API密钥|Создать API-ключ
My research integration|Mi integración de investigación|Meine Recherche-Integration|Minha integração de pesquisa|調査用の連携|研究集成|Моя интеграция для исследований
Copy this key now. It will never be shown again.|Copia la clave ahora. No se volverá a mostrar.|Kopieren Sie den Schlüssel jetzt. Er wird nicht erneut angezeigt.|Copie a chave agora. Ela não será mostrada novamente.|キーをコピーしてください。再表示はできません。|请立即复制密钥，不会再次显示。|Скопируйте ключ сейчас. Он больше не будет показан.
Request failed|La solicitud falló|Anfrage fehlgeschlagen|Falha na solicitação|リクエストに失敗しました|请求失败|Запрос не выполнен
Collect public complaints, feature requests, and workarounds. Every signal keeps its original source.|Recopila quejas, solicitudes y soluciones alternativas públicas. Cada señal conserva su fuente.|Sammeln Sie öffentliche Beschwerden, Funktionswünsche und Behelfslösungen mit Originalquelle.|Colete reclamações, pedidos e soluções alternativas públicas com suas fontes originais.|公開の不満・機能要望・回避策を出典とともに集めます。|采集公开投诉、功能请求和替代方案，保留原始来源。|Собирайте публичные жалобы, запросы функций и обходные решения. У каждого сигнала сохраняется источник.
Group related pains, understand who feels them, and separate commercial intent from noise.|Agrupa problemas relacionados, identifica a quién afectan y distingue la intención comercial.|Gruppieren Sie ähnliche Probleme, erkennen Sie Betroffene und kommerzielles Interesse.|Agrupe problemas relacionados, identifique o público e a intenção comercial.|関連する課題をまとめ、対象者と商業的な意図を把握します。|归类相关问题，识别受众和商业意图。|Группируйте похожие проблемы, определяйте аудиторию и отделяйте коммерческий интерес от шума.
Compare daily snapshots. See whether a problem is accelerating, stable, or fading.|Compara datos diarios y observa si el problema crece, se estabiliza o disminuye.|Vergleichen Sie tägliche Daten: wächst, stagniert oder schrumpft das Problem?|Compare dados diários: o problema cresce, estabiliza ou diminui?|日次データを比較し、課題の成長・安定・減少を確認します。|比较每日数据，判断问题增长、稳定或减弱。|Сравнивайте ежедневные снимки: проблема растёт, остаётся стабильной или затухает.
Real conversations, original links, transparent scoring. AI helps interpret the evidence — it never invents it.|Conversaciones reales, enlaces originales y puntuación transparente. La IA interpreta la evidencia.|Echte Diskussionen, Originalquellen, transparente Bewertungen. KI interpretiert Belege.|Conversas reais, links originais e avaliações transparentes. A IA interpreta evidências.|実際の会話、元のリンク、透明な評価。AIは証拠を解釈します。|真实讨论、原始链接和透明评分。AI帮助解读证据。|Реальные обсуждения, ссылки на источники и прозрачные оценки. ИИ помогает интерпретировать факты, а не придумывает их.
Facts, AI inference, and hypotheses clearly labeled|Hechos, inferencias e hipótesis identificados|Fakten, KI-Schlüsse und Hypothesen gekennzeichnet|Fatos, inferências e hipóteses identificados|事実・AI推論・仮説を明示|明确区分事实、AI推断和假设|Факты, выводы ИИ и гипотезы явно обозначены
Original sources one click away|Fuentes originales a un clic|Originalquellen mit einem Klick|Fontes originais a um clique|元の出典へワンクリック|一键访问原始来源|Исходные источники в одном клике
Confidence that reflects the sample size|Confianza basada en el tamaño de la muestra|Konfidenz passend zur Stichprobengröße|Confiança baseada no tamanho da amostra|標本の大きさに基づく確信度|置信度反映样本规模|Уверенность с учётом размера выборки
Open your intelligence workspace ↗|Abre tu espacio de análisis ↗|Analysebereich öffnen ↗|Abra seu espaço de análise ↗|分析ワークスペースを開く ↗|打开分析工作区 ↗|Открыть аналитическое пространство ↗
Opportunities appear after connected sources provide enough independent signals. No fabricated examples.|Las oportunidades aparecen cuando hay suficientes señales independientes. Sin ejemplos inventados.|Chancen erscheinen bei ausreichend unabhängigen Signalen. Keine erfundenen Beispiele.|Oportunidades aparecem com sinais independentes suficientes. Sem exemplos inventados.|独立したシグナルが十分に集まると機会が表示されます。架空の例はありません。|有足够独立信号后显示机会，没有虚构示例。|Возможности появляются после сбора достаточного количества независимых сигналов. Без выдуманных примеров.
Track a niche, audience, or keyword. Let the right signals come to you.|Sigue un nicho, público o palabra clave y recibe señales relevantes.|Verfolgen Sie Nischen, Zielgruppen oder Stichwörter für passende Signale.|Acompanhe nichos, públicos ou palavras-chave para receber sinais relevantes.|ニッチ・対象者・キーワードを追跡して関連シグナルを見つけます。|跟踪细分领域、受众或关键词，获取相关信号。|Отслеживайте нишу, аудиторию или ключевое слово и получайте подходящие сигналы.
Save problems worth following and see how their scores change.|Guarda problemas y observa cómo cambian sus puntuaciones.|Speichern Sie interessante Probleme und verfolgen Sie ihre Bewertungen.|Salve problemas e acompanhe suas pontuações.|課題を保存し、スコアの変化を確認します。|保存值得关注的问题，查看评分变化。|Сохраняйте интересные проблемы и следите за изменениями оценок.
Frequency, velocity, commercial intent, pain intensity, and freshness.|Frecuencia, crecimiento, intención comercial, intensidad y actualidad.|Häufigkeit, Wachstum, kommerzielles Interesse, Intensität und Aktualität.|Frequência, crescimento, intenção comercial, intensidade e atualidade.|頻度・成長・商業的意図・深刻度・新しさ。|频率、增长、商业意图、问题强度和时效。|Частота, скорость роста, коммерческий интерес, острота проблемы и свежесть данных.
Snapshots and reports grounded in observed signals, not imagined revenue.|Datos e informes basados en señales observadas.|Daten und Berichte auf Basis beobachteter Signale.|Dados e relatórios baseados em sinais observados.|観測したシグナルに基づくデータとレポート。|基于观察信号的数据和报告。|Снимки и отчёты на основе наблюдаемых сигналов, а не выдуманной выручки.
Does PainRadar generate startup ideas?|¿PainRadar genera ideas de negocio?|Generiert PainRadar Startup-Ideen?|PainRadar gera ideias de negócios?|PainRadarは事業案を作りますか？|PainRadar会生成创业点子吗？|PainRadar генерирует идеи стартапов?
It discovers and groups real problems first. MVP suggestions are hypotheses based on those signals, clearly separated from facts.|Primero agrupa problemas reales. Las sugerencias de MVP son hipótesis basadas en señales.|Zuerst werden reale Probleme gruppiert. MVP-Vorschläge sind Hypothesen auf Basis der Signale.|Primeiro agrupa problemas reais. Sugestões de MVP são hipóteses baseadas nos sinais.|まず実際の課題をまとめます。MVP案はシグナルに基づく仮説です。|先发现并归类真实问题，MVP建议是基于信号的假设。|Сначала он находит и группирует реальные проблемы. Предложения MVP — гипотезы на основе сигналов, отдельно от фактов.
Where does the evidence come from?|¿De dónde viene la evidencia?|Woher stammen die Belege?|De onde vêm as evidências?|証拠はどこから来ますか？|证据来自哪里？|Откуда берутся подтверждения?
The first adapters collect public data from Hacker News, GitHub Issues, and authorized Reddit API access. Availability depends on source permissions and configuration.|Se recopilan datos públicos de Hacker News, GitHub Issues y acceso autorizado a Reddit, según permisos y configuración.|Öffentliche Daten aus Hacker News, GitHub Issues und autorisiertem Reddit-Zugriff, abhängig von Berechtigungen und Konfiguration.|Dados públicos do Hacker News, GitHub Issues e acesso autorizado ao Reddit, conforme permissões e configuração.|Hacker News、GitHub Issues、認可されたReddit APIから公開データを集めます。利用可否は設定に依存します。|从Hacker News、GitHub Issues和授权Reddit API采集公开数据，取决于权限和配置。|Адаптеры собирают публичные данные Hacker News, GitHub Issues и Reddit через разрешённый API. Доступность зависит от прав и настроек.
Can a score guarantee demand?|¿La puntuación garantiza demanda?|Garantiert eine Bewertung Nachfrage?|A pontuação garante demanda?|スコアは需要を保証しますか？|评分能保证需求吗？|Оценка гарантирует спрос?
No. Scores summarize observed signals. Confidence reflects evidence volume, independent authors, source diversity, and freshness. Validate with potential customers before building.|No. La puntuación resume señales. Valida la demanda con clientes antes de crear.|Nein. Bewertungen fassen Signale zusammen. Prüfen Sie die Nachfrage mit Kunden vor der Entwicklung.|Não. Pontuações resumem sinais. Valide a demanda com clientes antes de criar.|いいえ。スコアはシグナルの要約です。開発前に顧客と需要を検証してください。|不能。评分概括观察信号，开发前请向潜在客户验证需求。|Нет. Оценки обобщают сигналы. Уверенность учитывает объём данных, независимых авторов, разнообразие источников и свежесть. До разработки проверьте спрос с клиентами.
Can I get started for free?|¿Puedo empezar gratis?|Kann ich kostenlos starten?|Posso começar grátis?|無料で始められますか？|可以免费开始吗？|Можно начать бесплатно?
Yes. The Free plan includes five opportunity opens per day, one custom radar, and seven days of history.|Sí. El plan gratuito incluye cinco oportunidades al día, un radar y siete días de historial.|Ja. Kostenlos: fünf Chancen pro Tag, ein Radar und sieben Tage Verlauf.|Sim. O plano grátis inclui cinco oportunidades por dia, um radar e sete dias de histórico.|はい。無料プランは1日5件の機会、1レーダー、7日分の履歴を含みます。|可以。免费方案包括每天查看5个机会、1个雷达和7天历史。|Да. Бесплатный тариф включает пять открытий возможностей в день, один радар и семь дней истории.
Find the pain. Follow the evidence. Make something people need.|Encuentra el problema, sigue la evidencia y crea algo útil.|Finden Sie Probleme, folgen Sie Belegen und entwickeln Sie etwas Nützliches.|Encontre o problema, siga as evidências e crie algo útil.|課題を見つけ、証拠を追い、人々に必要なものを作りましょう。|发现问题，跟随证据，创造人们需要的产品。|Найдите проблему. Изучите подтверждения. Создайте то, что нужно людям.
Create team|Crear equipo|Team erstellen|Criar equipe|チームを作成|创建团队|Создать команду
Create workspace|Crear espacio|Arbeitsbereich erstellen|Criar espaço|ワークスペースを作成|创建工作区|Создать пространство
Workspace name|Nombre del espacio|Name des Arbeitsbereichs|Nome do espaço|ワークスペース名|工作区名称|Название пространства
Client name|Nombre del cliente|Kundenname|Nome do cliente|顧客名|客户名称|Имя клиента
Report brand name|Marca del informe|Berichtsmarke|Marca do relatório|レポートのブランド名|报告品牌名称|Бренд отчёта
Brand color|Color de marca|Markenfarbe|Cor da marca|ブランドカラー|品牌颜色|Цвет бренда
Agency name|Nombre de agencia|Agenturname|Nome da agência|代理店名|机构名称|Название агентства
Create invitation|Crear invitación|Einladung erstellen|Criar convite|招待を作成|创建邀请|Создать приглашение
Recipient email|Correo del destinatario|Empfänger-E-Mail|E-mail do destinatário|招待先メール|收件人邮箱|Почта получателя
Member|Miembro|Mitglied|Membro|メンバー|成员|Участник
Administrator|Administrador|Administrator|Administrador|管理者|管理员|Администратор
Integration name|Nombre de integración|Integrationsname|Nome da integração|連携名|集成名称|Название интеграции
Public HTTPS endpoint|Endpoint HTTPS público|Öffentlicher HTTPS-Endpunkt|Endpoint HTTPS público|公開HTTPSエンドポイント|公共HTTPS端点|Публичный HTTPS-адрес
Create webhook|Crear webhook|Webhook erstellen|Criar webhook|Webhookを作成|创建Webhook|Создать вебхук
Save branding|Guardar marca|Marke speichern|Salvar marca|ブランド設定を保存|保存品牌设置|Сохранить оформление
Update client access|Actualizar acceso|Kundenzugriff aktualisieren|Atualizar acesso|顧客アクセスを更新|更新客户访问|Обновить доступ клиента
Team member|Miembro del equipo|Teammitglied|Membro da equipe|チームメンバー|团队成员|Участник команды
Workspace role|Rol en el espacio|Arbeitsbereichsrolle|Função no espaço|ワークスペースの権限|工作区角色|Роль в пространстве
Viewer|Lector|Betrachter|Leitor|閲覧者|查看者|Наблюдатель
Editor|Editor|Bearbeiter|Editor|編集者|编辑者|Редактор
Remove assignment|Eliminar asignación|Zuweisung entfernen|Remover atribuição|割り当てを解除|移除分配|Убрать назначение
Role|Rol|Rolle|Função|権限|角色|Роль
Save changes|Guardar cambios|Änderungen speichern|Salvar alterações|変更を保存|保存更改|Сохранить изменения
Create radar →|Crear radar →|Radar erstellen →|Criar radar →|レーダーを作成 →|创建雷达 →|Создать радар →
Radar updated. Alerts will use the saved filters.|Radar actualizado. Las alertas usarán los filtros guardados.|Radar aktualisiert. Meldungen verwenden die gespeicherten Filter.|Radar atualizado. Alertas usarão os filtros salvos.|レーダーを更新しました。保存した条件で通知します。|雷达已更新，通知将使用已保存的筛选。|Радар обновлён. Уведомления используют сохранённые фильтры.
Radar created. Alerts will follow matching evidence.|Radar creado. Las alertas seguirán la evidencia coincidente.|Radar erstellt. Meldungen verfolgen passende Belege.|Radar criado. Alertas seguirão evidências correspondentes.|レーダーを作成しました。条件に合う証拠を通知します。|雷达已创建，通知将跟踪匹配证据。|Радар создан. Уведомления отслеживают подходящие подтверждения.
By continuing, you agree to our|Al continuar, aceptas nuestros|Mit der Fortsetzung akzeptieren Sie unsere|Ao continuar, você concorda com nossos|続行すると以下に同意します：|继续即表示您同意我们的|Продолжая, вы соглашаетесь с документами:
and|y|und|e|および|和|и
5 opportunities per day|5 oportunidades al día|5 Chancen pro Tag|5 oportunidades por dia|1日5件の機会|每天5个机会|5 возможностей в день
1 custom radar|1 radar personalizado|1 eigenes Radar|1 radar personalizado|1つのカスタムレーダー|1个自定义雷达|1 персональный радар
7-day history|Historial de 7 días|7 Tage Verlauf|Histórico de 7 dias|7日分の履歴|7天历史|История за 7 дней
Original evidence links|Enlaces a evidencia original|Links zu Originalbelegen|Links para evidências originais|元の証拠へのリンク|原始证据链接|Ссылки на исходные подтверждения
Unlimited opportunities|Oportunidades ilimitadas|Unbegrenzte Chancen|Oportunidades ilimitadas|機会の閲覧が無制限|无限机会|Безлимитные возможности
10 custom radars|10 radares personalizados|10 eigene Radare|10 radares personalizados|10のカスタムレーダー|10个自定义雷达|10 персональных радаров
90-day history|Historial de 90 días|90 Tage Verlauf|Histórico de 90 dias|90日分の履歴|90天历史|История за 90 дней
CSV exports & email alerts|Exportaciones CSV y alertas por correo|CSV-Export und E-Mail-Meldungen|Exportações CSV e alertas por e-mail|CSV出力とメール通知|CSV导出和邮件通知|Экспорт CSV и уведомления по почте
Unlimited radars|Radares ilimitados|Unbegrenzte Radare|Radares ilimitados|無制限のレーダー|无限雷达|Безлимитные радары
Competitor evidence research|Investigación de competencia|Wettbewerbsrecherche|Pesquisa de concorrentes|競合調査|竞争对手研究|Исследование конкурентов
AI MVP generator|Generador MVP con IA|KI-MVP-Generator|Gerador de MVP com IA|AIによるMVP案|AI生成MVP|Генератор MVP с ИИ
API access & reports|Acceso API e informes|API-Zugriff und Berichte|Acesso API e relatórios|APIアクセスとレポート|API访问和报告|API и отчёты
1 team, up to 50 members & 100 clients|1 equipo, hasta 50 miembros y 100 clientes|1 Team, bis zu 50 Mitglieder und 100 Kunden|1 equipe, até 50 membros e 100 clientes|1チーム、最大50人と100顧客|1个团队，最多50名成员和100名客户|1 команда, до 50 участников и 100 клиентов
Shared watchlists & 100 radars per client|Listas compartidas y 100 radares por cliente|Geteilte Merklisten und 100 Radare pro Kunde|Listas compartilhadas e 100 radares por cliente|共有リストと顧客ごとに100レーダー|共享关注列表，每客户100个雷达|Общее избранное и 100 радаров на клиента
White-label reports & scoped API keys|Informes de marca y claves API limitadas|Berichte mit eigener Marke und begrenzte API-Schlüssel|Relatórios com marca própria e chaves API restritas|独自ブランドのレポートと限定APIキー|自有品牌报告和限定API密钥|Отчёты под вашим брендом и API-ключи с ограниченными правами
Signed webhooks with delivery retries|Webhooks firmados con reintentos|Signierte Webhooks mit Wiederholungen|Webhooks assinados com novas tentativas|署名付きWebhookと再送|签名Webhook和重试|Подписанные вебхуки с повторной доставкой
month|mes|Monat|mês|月|月|месяц
Not enough historical snapshots yet.|Aún no hay suficiente historial.|Noch nicht genug Verlaufsdaten.|Ainda não há histórico suficiente.|履歴データが不足しています。|历史数据不足。|Пока недостаточно исторических снимков.
Daily observed mentions|Menciones diarias observadas|Täglich beobachtete Erwähnungen|Menções diárias observadas|日次の言及数|每日观察提及数|Наблюдаемые упоминания за день
snapshots|registros|Momentaufnahmen|registros|記録|快照|снимков
Retry|Reintentar|Erneut versuchen|Tentar novamente|再試行|重试|Повторить
Loading sessions…|Cargando sesiones…|Sitzungen laden…|Carregando sessões…|セッションを読み込み中…|加载会话…|Загружаем сессии…
No active sessions found.|No hay sesiones activas.|Keine aktiven Sitzungen gefunden.|Nenhuma sessão ativa.|有効なセッションはありません。|未找到活跃会话。|Активных сессий нет.
This device|Este dispositivo|Dieses Gerät|Este dispositivo|このデバイス|此设备|Это устройство
Other device|Otro dispositivo|Anderes Gerät|Outro dispositivo|他のデバイス|其他设备|Другое устройство
Browser details unavailable|Detalles del navegador no disponibles|Browserdetails nicht verfügbar|Detalhes do navegador indisponíveis|ブラウザー情報は不明です|浏览器信息不可用|Информация о браузере недоступна
End session|Cerrar sesión|Sitzung beenden|Encerrar sessão|セッションを終了|结束会话|Завершить сессию
Ending…|Cerrando…|Wird beendet…|Encerrando…|終了中…|正在结束…|Завершаем…
Change password|Cambiar contraseña|Passwort ändern|Alterar senha|パスワードを変更|修改密码|Изменить пароль
New|Nueva|Neu|Nova|新規|新|Новая
Growing|Creciendo|Wachsend|Crescendo|成長中|增长中|Растёт
Surging|En auge|Stark wachsend|Em alta|急成長|快速增长|Быстро растёт
Declining|Disminuyendo|Abnehmend|Diminuindo|減少中|下降中|Снижается
Stable|Estable|Stabil|Estável|安定|稳定|Стабильна
Accelerating|Acelerando|Beschleunigend|Acelerando|加速中|加速中|Ускоряется
Manual subscriptions|Suscripciones manuales|Manuelle Abonnements|Assinaturas manuais|手動サブスクリプション|手动订阅|Ручные подписки
Grant access without charging the user. Stripe billing stays separate; the higher active plan applies.|Otorga acceso sin cobrar al usuario. Stripe sigue separado; se aplica el plan activo superior.|Zugang ohne Zahlung gewähren. Stripe bleibt separat; der höhere aktive Tarif gilt.|Conceda acesso sem cobrar. Stripe permanece separado; vale o plano ativo superior.|課金せずアクセスを付与します。Stripeとは別管理で、有効な上位プランが適用されます。|免费授予访问权限。Stripe独立管理，采用较高的有效套餐。|Выдайте доступ без оплаты. Подписка Stripe учитывается отдельно; действует более высокий активный тариф.
User email|Correo del usuario|Benutzer-E-Mail|Email do usuário|ユーザーのメール|用户邮箱|Email пользователя
Find user|Buscar usuario|Benutzer suchen|Buscar usuário|ユーザー検索|查找用户|Найти пользователя
Manual access|Acceso manual|Manueller Zugang|Acesso manual|手動アクセス|手动访问权限|Ручной доступ
No active manual subscription.|No hay suscripción manual activa.|Kein aktives manuelles Abonnement.|Nenhuma assinatura manual ativa.|有効な手動サブスクリプションはありません。|没有有效的手动订阅。|Нет действующей ручной подписки.
This subscription is already lifetime.|Esta suscripción ya es vitalicia.|Dieses Abonnement ist bereits unbefristet.|Esta assinatura já é vitalícia.|このサブスクリプションは無期限です。|此订阅已是永久订阅。|Эта подписка уже бессрочная.
User not found.|Usuario no encontrado.|Benutzer nicht gefunden.|Usuário não encontrado.|ユーザーが見つかりません。|未找到用户。|Пользователь не найден.
Enter a valid email.|Introduce un correo válido.|Gültige E-Mail eingeben.|Informe um email válido.|有効なメールを入力してください。|请输入有效邮箱。|Введите корректный email.
Grant or replace access|Otorgar o reemplazar acceso|Zugang gewähren oder ersetzen|Conceder ou substituir acesso|アクセス付与・変更|授予或替换访问权限|Выдать или заменить доступ
Extend access|Ampliar acceso|Zugang verlängern|Prorrogar acesso|アクセス延長|延长访问权限|Продлить доступ
Revoke manual access|Revocar acceso manual|Manuellen Zugang widerrufen|Revogar acesso manual|手動アクセス取消|撤销手动访问权限|Отозвать ручной доступ
Grant access|Otorgar acceso|Zugang gewähren|Conceder acesso|アクセス付与|授予访问权限|Выдать доступ
Duration|Duración|Dauer|Duração|期間|期限|Срок
Lifetime|Vitalicio|Unbefristet|Vitalício|無期限|永久|Бессрочно
Reason|Motivo|Grund|Motivo|理由|原因|Причина
Days are added to the current expiration date.|Los días se suman a la fecha de vencimiento actual.|Tage werden zum aktuellen Ablaufdatum hinzugefügt.|Os dias são adicionados à data de vencimento atual.|現在の有効期限に日数を追加します。|天数将加到当前到期日。|Дни добавляются к текущей дате окончания.
Only manual access will be revoked. Stripe payments will continue.|Solo se revoca el acceso manual. Los pagos de Stripe continúan.|Nur manueller Zugang wird widerrufen. Stripe-Zahlungen laufen weiter.|Somente o acesso manual será revogado. Os pagamentos Stripe continuam.|手動アクセスのみ取り消します。Stripeの支払いは継続します。|仅撤销手动访问权限，Stripe付款将继续。|Будет отозван только ручной доступ. Платежи Stripe продолжатся.
This replaces existing manual access. The term starts now.|Reemplaza el acceso manual actual. El plazo empieza ahora.|Ersetzt den bestehenden manuellen Zugang. Die Laufzeit beginnt jetzt.|Substitui o acesso manual atual. O prazo começa agora.|既存の手動アクセスを置き換えます。期間は今から開始します。|替换现有手动访问权限，期限从现在开始。|Заменяет существующий ручной доступ. Срок начинается сейчас.
Access history|Historial de acceso|Zugangsverlauf|Histórico de acesso|アクセス履歴|访问权限历史|История доступа
No access changes yet.|Aún no hay cambios de acceso.|Noch keine Zugangsänderungen.|Ainda não há alterações de acesso.|アクセス変更はまだありません。|暂无访问权限变更。|Изменений доступа пока нет.
Access until|Acceso hasta|Zugang bis|Acesso até|有効期限|有效至|Доступ до
Subscription updated.|Suscripción actualizada.|Abonnement aktualisiert.|Assinatura atualizada.|サブスクリプションを更新しました。|订阅已更新。|Подписка обновлена.
Active plan|Plan activo|Aktiver Tarif|Plano ativo|有効なプラン|有效套餐|Действующий тариф
Invalid subscription request.|Solicitud de suscripción inválida.|Ungültige Abonnementanfrage.|Solicitação de assinatura inválida.|無効なサブスクリプション要求です。|无效的订阅请求。|Некорректные данные подписки.
Reddit API keys are missing. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to the production environment, redeploy, then start collection.|Faltan las claves de Reddit. Añade REDDIT_CLIENT_ID y REDDIT_CLIENT_SECRET en producción, vuelve a desplegar e inicia la recopilación.|Reddit-API-Schlüssel fehlen. REDDIT_CLIENT_ID und REDDIT_CLIENT_SECRET in Produktion hinzufügen, neu deployen und Sammlung starten.|Faltam as chaves Reddit. Adicione REDDIT_CLIENT_ID e REDDIT_CLIENT_SECRET em produção, publique novamente e inicie a coleta.|RedditのAPIキーが未設定です。本番環境にREDDIT_CLIENT_IDとREDDIT_CLIENT_SECRETを追加し、再デプロイ後に収集してください。|缺少Reddit API密钥。请在生产环境添加REDDIT_CLIENT_ID和REDDIT_CLIENT_SECRET，重新部署后开始采集。|Не настроены ключи Reddit API. Добавьте REDDIT_CLIENT_ID и REDDIT_CLIENT_SECRET в Production, выполните деплой и запустите сбор.
Reddit authorization was rejected. Check the API keys and approved Reddit API access.|Reddit rechazó la autorización. Revisa las claves y el acceso aprobado a la API.|Reddit-Autorisierung abgelehnt. API-Schlüssel und genehmigten API-Zugang prüfen.|Autorização Reddit rejeitada. Verifique as chaves e o acesso aprovado à API.|Reddit認証が拒否されました。APIキーと承認済みアクセスを確認してください。|Reddit授权被拒绝。请检查密钥和已批准的API访问权限。|Reddit отклонил авторизацию. Проверьте ключи и одобренный доступ к API.
Check the Reddit community names. Enter names without r/ or a URL.|Revisa los nombres de comunidades. Escríbelos sin r/ ni URL.|Community-Namen ohne r/ oder URL eingeben.|Verifique os nomes das comunidades, sem r/ ou URL.|コミュニティ名を確認してください。r/やURLは不要です。|请检查社区名称，不要输入r/或网址。|Проверьте названия сообществ Reddit. Укажите имена без r/ и ссылок.
Reddit denied access. Check API approval and whether the community is public.|Reddit denegó el acceso. Revisa la aprobación de la API y si la comunidad es pública.|Reddit verweigert Zugriff. API-Genehmigung und öffentliche Community prüfen.|Reddit negou acesso. Verifique aprovação da API e se a comunidade é pública.|Redditがアクセスを拒否しました。API承認と公開コミュニティかを確認してください。|Reddit拒绝访问。请检查API批准状态及社区是否公开。|Reddit запретил доступ. Проверьте разрешение на API и доступность сообщества.
Reddit community not found. Check its name and availability.|Comunidad Reddit no encontrada. Revisa su nombre y disponibilidad.|Reddit-Community nicht gefunden. Name und Verfügbarkeit prüfen.|Comunidade Reddit não encontrada. Verifique nome e disponibilidade.|Redditコミュニティが見つかりません。名前と公開状態を確認してください。|未找到Reddit社区。请检查名称和可用性。|Сообщество Reddit не найдено. Проверьте его название и доступность.
Reddit did not return a valid access token. Check the application credentials.|Reddit no devolvió un token válido. Revisa las credenciales de la aplicación.|Reddit lieferte kein gültiges Zugriffstoken. App-Zugangsdaten prüfen.|Reddit não retornou token válido. Verifique as credenciais do aplicativo.|Redditから有効なトークンが返されませんでした。アプリの認証情報を確認してください。|Reddit未返回有效令牌。请检查应用凭据。|Reddit не вернул корректный токен доступа. Проверьте данные приложения.
The source rate limit was reached. Wait before starting collection again.|Se alcanzó el límite de la fuente. Espera antes de recopilar de nuevo.|Quellenlimit erreicht. Vor dem erneuten Sammeln warten.|Limite da fonte atingido. Aguarde antes de coletar novamente.|ソースの制限に達しました。時間をおいて再度収集してください。|已达到来源请求限制。请稍后重新采集。|Достигнут лимит запросов источника. Подождите перед повторным сбором.
CSV import|Importación CSV|CSV-Import|Importação CSV|CSVインポート|CSV导入|Импорт CSV
Keywords, separated by commas|Palabras clave separadas por comas|Kommagetrennte Stichwörter|Palavras-chave separadas por vírgulas|キーワード（カンマ区切り）|关键词，以逗号分隔|Ключевые слова через запятую
GitHub projects: owner/repository|Proyectos GitHub: propietario/repositorio|GitHub-Projekte: Eigentümer/Repository|Projetos GitHub: proprietário/repositório|GitHubプロジェクト: 所有者/リポジトリ|GitHub项目：所有者/仓库|Проекты GitHub: владелец/репозиторий
Reddit community names without r/|Comunidades Reddit sin r/|Reddit-Communities ohne r/|Comunidades Reddit sem r/|Redditコミュニティ名（r/なし）|Reddit社区名称，不含r/|Названия сообществ Reddit без r/
Tags, separated by commas (one tag per search)|Etiquetas separadas por comas (una por búsqueda)|Tags mit Kommas trennen (einer pro Suche)|Tags separadas por vírgulas (uma por busca)|タグ（カンマ区切り、検索ごとに1つ）|标签，以逗号分隔，每次搜索一个标签|Теги через запятую (один тег на поиск)
GitLab.com projects: group/project or group/subgroup/project|Proyectos GitLab.com: grupo/proyecto o grupo/subgrupo/proyecto|GitLab.com-Projekte: Gruppe/Projekt oder Gruppe/Untergruppe/Projekt|Projetos GitLab.com: grupo/projeto ou grupo/subgrupo/projeto|GitLab.com: グループ/プロジェクト、サブグループも可|GitLab.com项目：组/项目或组/子组/项目|Проекты GitLab.com: группа/проект или группа/подгруппа/проект
Public Discourse forum base URLs (HTTPS)|URLs base de foros Discourse públicos (HTTPS)|Basis-URLs öffentlicher Discourse-Foren (HTTPS)|URLs base de fóruns Discourse públicos (HTTPS)|公開DiscourseフォーラムのURL（HTTPS）|公开Discourse论坛基础网址（HTTPS）|Адреса публичных форумов Discourse (HTTPS)
Public RSS or Atom feed URLs (HTTPS)|URLs de fuentes RSS o Atom públicas (HTTPS)|URLs öffentlicher RSS-/Atom-Feeds (HTTPS)|URLs de feeds RSS ou Atom públicos (HTTPS)|公開RSS・AtomフィードURL（HTTPS）|公开RSS或Atom订阅网址（HTTPS）|Адреса публичных RSS или Atom лент (HTTPS)
Stack Exchange site|Sitio Stack Exchange|Stack-Exchange-Website|Site Stack Exchange|Stack Exchangeサイト|Stack Exchange站点|Сайт Stack Exchange
Example: stackoverflow, superuser, serverfault|Ejemplo: stackoverflow, superuser, serverfault|Beispiel: stackoverflow, superuser, serverfault|Exemplo: stackoverflow, superuser, serverfault|例: stackoverflow, superuser, serverfault|例如：stackoverflow、superuser、serverfault|Например: stackoverflow, superuser, serverfault
Questions from a selected Stack Exchange site, with author attribution and source links.|Preguntas de un sitio Stack Exchange con autor y enlaces.|Fragen einer Stack-Exchange-Website mit Autorenangabe und Quelllinks.|Perguntas de um site Stack Exchange, com autoria e links.|選択したStack Exchangeの質問。著者と出典リンクを保持します。|所选Stack Exchange站点的问题，保留作者和来源链接。|Вопросы выбранного сайта Stack Exchange с указанием автора и ссылкой на источник.
Public issues in selected GitLab.com projects.|Issues públicos de proyectos GitLab.com seleccionados.|Öffentliche Issues ausgewählter GitLab.com-Projekte.|Issues públicos de projetos GitLab.com selecionados.|選択したGitLab.comプロジェクトの公開Issue。|所选GitLab.com项目的公开问题。|Публичные Issues выбранных проектов GitLab.com.
Public posts from configured Discourse forums.|Publicaciones públicas de foros Discourse configurados.|Öffentliche Beiträge konfigurierter Discourse-Foren.|Publicações de fóruns Discourse configurados.|設定したDiscourseフォーラムの公開投稿。|已配置Discourse论坛的公开帖子。|Публичные сообщения настроенных форумов Discourse.
Published entries from configured RSS and Atom feeds. Feed coverage depends on the publisher.|Entradas RSS y Atom. La cobertura depende del editor.|Einträge aus RSS-/Atom-Feeds. Die Abdeckung hängt vom Herausgeber ab.|Entradas RSS e Atom. A cobertura depende do editor.|RSS・Atomの公開記事。取得範囲は配信元に依存します。|RSS和Atom发布条目，覆盖范围取决于发布者。|Публикации настроенных RSS и Atom лент. Полнота ленты зависит от издателя.
Administrator imports of authorized data. Imported records enter the same analysis queue.|Importaciones autorizadas del administrador a la cola de análisis.|Autorisierte Datenimporte durch Administratoren in dieselbe Analysewarteschlange.|Dados autorizados importados pelo administrador entram na fila de análise.|管理者が許可済みデータをインポートし、分析キューに追加します。|管理员导入授权数据，记录进入同一分析队列。|Импорт разрешённых данных администратором. Записи поступают в общую очередь анализа.
Import up to 200 records (500 KB). All rows are validated before saving.|Importa hasta 200 registros (500 KB). Se validan antes de guardar.|Bis zu 200 Datensätze (500 KB). Prüfung vor dem Speichern.|Importe até 200 registros (500 KB). Validação antes de salvar.|最大200件（500 KB）。保存前に全行を検証します。|最多导入200条（500 KB），保存前验证所有行。|До 200 записей (500 КБ). Все строки проверяются перед сохранением.
Columns: title, content, url, published_at; author is optional. Use ISO timestamps with a timezone, for example 2026-10-01T12:00:00Z.|Columnas: title, content, url, published_at; author opcional. Fecha ISO con zona horaria, por ejemplo 2026-10-01T12:00:00Z.|Spalten: title, content, url, published_at; author optional. ISO-Zeit mit Zeitzone, z. B. 2026-10-01T12:00:00Z.|Colunas: title, content, url, published_at; author opcional. Data ISO com fuso, como 2026-10-01T12:00:00Z.|列: title, content, url, published_at。authorは任意。日時は例のようにタイムゾーン付きISO形式: 2026-10-01T12:00:00Z。|列：title、content、url、published_at；author可选。使用含时区的ISO时间，如2026-10-01T12:00:00Z。|Столбцы: title, content, url, published_at; author необязателен. Дата в ISO с часовым поясом, например 2026-10-01T12:00:00Z.
Download CSV template|Descargar plantilla CSV|CSV-Vorlage herunterladen|Baixar modelo CSV|CSVテンプレートをダウンロード|下载CSV模板|Скачать шаблон CSV
Choose CSV file|Elegir archivo CSV|CSV-Datei auswählen|Escolher arquivo CSV|CSVファイルを選択|选择CSV文件|Выбрать CSV-файл
Records in file|Registros en el archivo|Datensätze in der Datei|Registros no arquivo|ファイル内の件数|文件记录数|Записей в файле
These records may be shared with signed-in users. I have permission to upload them and have removed private or sensitive data.|Estos registros pueden compartirse con usuarios registrados. Tengo permiso y eliminé datos privados o sensibles.|Diese Datensätze dürfen mit angemeldeten Nutzern geteilt werden. Ich habe die Erlaubnis und private oder sensible Daten entfernt.|Estes registros podem ser compartilhados com usuários conectados. Tenho permissão e removi dados privados ou sensíveis.|これらの記録はログインユーザーに共有できます。アップロード許可があり、個人情報・機密情報は削除済みです。|这些记录可分享给登录用户。我拥有上传权限并已移除隐私或敏感数据。|Эти записи можно показывать вошедшим пользователям. У меня есть разрешение на загрузку, личные и чувствительные данные удалены.
Importing…|Importando…|Importieren…|Importando…|インポート中…|正在导入…|Импорт…
Import signals|Importar señales|Signale importieren|Importar sinais|シグナルをインポート|导入信号|Импортировать сигналы
Import failed.|Error de importación.|Import fehlgeschlagen.|Falha na importação.|インポートに失敗しました。|导入失败。|Не удалось выполнить импорт.
Imported|Importados|Importiert|Importados|インポート済み|已导入|Импортировано
Start processing to analyze the imported signals.|Inicia el procesamiento para analizar las señales.|Verarbeitung starten, um importierte Signale zu analysieren.|Inicie o processamento para analisar os sinais.|処理を開始してインポートしたシグナルを分析してください。|开始处理以分析导入信号。|Запустите обработку для анализа импортированных сигналов.
CSV file is too large (maximum 500 KB).|CSV demasiado grande (máximo 500 KB).|CSV-Datei zu groß (maximal 500 KB).|CSV muito grande (máximo 500 KB).|CSVが大きすぎます（最大500 KB）。|CSV文件过大（最大500 KB）。|CSV-файл слишком большой (максимум 500 КБ).
CSV must contain between 1 and 200 records.|CSV debe contener entre 1 y 200 registros.|CSV muss 1 bis 200 Datensätze enthalten.|CSV deve conter entre 1 e 200 registros.|CSVは1〜200件必要です。|CSV必须包含1至200条记录。|CSV должен содержать от 1 до 200 записей.
CSV requires title, content, url, published_at; author is optional.|CSV requiere title, content, url, published_at; author opcional.|CSV benötigt title, content, url, published_at; author optional.|CSV requer title, content, url, published_at; author opcional.|CSVにはtitle, content, url, published_atが必要です。authorは任意。|CSV必须含title、content、url、published_at；author可选。|CSV требует title, content, url, published_at; author необязателен.
CSV could not be parsed. Check quotes, commas and column names.|No se pudo leer CSV. Revisa comillas, comas y columnas.|CSV nicht lesbar. Anführungszeichen, Kommas und Spalten prüfen.|Não foi possível ler CSV. Verifique aspas, vírgulas e colunas.|CSVを解析できません。引用符、カンマ、列名を確認してください。|无法解析CSV，请检查引号、逗号和列名。|Не удалось прочитать CSV. Проверьте кавычки, запятые и названия столбцов.
Confirm that these records may be shared with signed-in users.|Confirma que pueden compartirse con usuarios registrados.|Freigabe für angemeldete Nutzer bestätigen.|Confirme o compartilhamento com usuários conectados.|ログインユーザーへの共有を確認してください。|请确认这些记录可分享给登录用户。|Подтвердите, что записи можно показывать вошедшим пользователям.
The source requested a pause. Collection will resume after its retry time.|La fuente solicitó una pausa. Se reanudará después del plazo.|Die Quelle verlangt eine Pause. Sammlung nach der Wartezeit fortsetzen.|A fonte pediu pausa. A coleta retoma após o prazo.|ソースが一時停止を要求しました。再試行時刻後に収集できます。|来源要求暂停，重试时间后可恢复采集。|Источник запросил паузу. Сбор можно продолжить после указанного времени.
Configure projects, tags, forums or feed URLs before collecting.|Configura proyectos, etiquetas, foros o fuentes antes de recopilar.|Projekte, Tags, Foren oder Feed-URLs vor dem Sammeln konfigurieren.|Configure projetos, tags, fóruns ou feeds antes da coleta.|収集前にプロジェクト、タグ、フォーラム、フィードを設定してください。|采集前请配置项目、标签、论坛或订阅网址。|Настройте проекты, теги, форумы или адреса лент перед сбором.
Check the source settings and scope names.|Revisa configuración y nombres de la fuente.|Quelleneinstellungen und Namen prüfen.|Verifique configurações e nomes da fonte.|ソース設定と名前を確認してください。|请检查来源设置和范围名称。|Проверьте настройки источника и названия областей сбора.
Only public projects can be collected.|Solo se admiten proyectos públicos.|Nur öffentliche Projekte können gesammelt werden.|Somente projetos públicos podem ser coletados.|公開プロジェクトのみ収集できます。|只能采集公开项目。|Можно собирать только публичные проекты.
The URL did not return a valid RSS or Atom feed.|La URL no devolvió una fuente RSS o Atom válida.|Die URL lieferte keinen gültigen RSS-/Atom-Feed.|A URL não retornou feed RSS ou Atom válido.|URLから有効なRSS・Atomフィードが返されませんでした。|网址未返回有效RSS或Atom订阅。|Адрес не вернул корректную RSS или Atom ленту.
The source response was too large or timed out. Try a smaller scope.|Respuesta demasiado grande o lenta. Reduce el alcance.|Quellenantwort zu groß oder Zeitüberschreitung. Umfang reduzieren.|Resposta muito grande ou lenta. Reduza o escopo.|応答が大きすぎるかタイムアウトしました。範囲を減らしてください。|来源响应过大或超时，请缩小范围。|Ответ источника слишком большой или истекло время ожидания. Уменьшите область сбора.
Retry after|Reintentar después|Erneut versuchen nach|Tentar após|再試行可能時刻|重试时间|Повторить после
CSV imports are visible to signed-in users; do not upload private customer data.|Los CSV son visibles para usuarios registrados; no subas datos privados.|CSV-Importe sind für angemeldete Nutzer sichtbar; keine privaten Kundendaten hochladen.|CSV aparece para usuários conectados; não envie dados privados de clientes.|CSVはログインユーザーに表示されます。顧客の非公開情報をアップロードしないでください。|CSV导入对登录用户可见，请勿上传客户隐私数据。|CSV-импорт виден вошедшим пользователям; не загружайте личные данные клиентов.
License|Licencia|Lizenz|Licença|ライセンス|许可|Лицензия
Paused|En pausa|Pausiert|Pausado|一時停止|已暂停|Пауза
`;
export const messages: Record<
  string,
  Record<Locale, string>
> = Object.fromEntries(
  rows
    .trim()
    .split("\n")
    .map((row) => {
      const values = row.split("|");
      if (values.length !== 7) throw new Error("Invalid translation row");
      return [
        values[0],
        Object.fromEntries(
          locales.map((locale, i) => [locale, values[i]]),
        ) as Record<Locale, string>,
      ];
    }),
);
export function translate(locale: Locale, text: string) {
  return messages[text]?.[locale] ?? text;
}
