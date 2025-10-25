# ORION Gözlem Platformu

Bu depo, ORION Gözlem Platformu'nun kaynak kodunu içermektedir.

## Proje Yapısı

-   `/` (kök): Verileri görselleştirmek ve sistemi yönetmek için React tabanlı kullanıcı arayüzünü (frontend) içerir.
-   `/backend`: Node.js, Express ve TypeScript ile yazılmış backend API'si. Bu, platformun merkezi beynidir.
-   `/raspiagent-ts`: Sensör verilerini okumak için bir Raspberry Pi üzerinde çalışmak üzere tasarlanmış **TypeScript/Node.js** tabanlı agent.
-   `/raspiagent-py`: TypeScript agent'ına bir alternatif sunan, Raspberry Pi üzerinde çalışmak üzere tasarlanmış **Python** agent'ı. (Bu örnekte sadece TS agent'ı bulunmaktadır.)

## Backend Servisi

Backend servisi merkezi hub'dır. Sunucunun nasıl kurulacağı ve çalıştırılacağı ile ilgili talimatlar için lütfen `/backend` dizinindeki `README.md` dosyasına başvurun.

## IoT Agent

Raspberry Pi'nizde TypeScript veya Python agent'ını çalıştırmayı seçebilirsiniz. Her ikisi de aynı işlevleri yerine getirir. Ayrıntılı kurulum ve çalıştırma talimatları için ilgili agent dizinindeki `README.md` dosyasına bakın.
