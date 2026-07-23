FROM alpine:latest

RUN apk add --no-cache curl unzip ca-certificates tzdata

ARG XRAY_VERSION=1.8.24
RUN curl -L https://github.com/XTLS/Xray-core/releases/download/v${XRAY_VERSION}/Xray-linux-64.zip -o /tmp/xray.zip \
    && unzip /tmp/xray.zip -d /usr/local/bin/ \
    && rm /tmp/xray.zip \
    && chmod +x /usr/local/bin/xray

COPY config.json /etc/xray/config.json

EXPOSE 3001

CMD ["xray", "-c", "/etc/xray/config.json"]
