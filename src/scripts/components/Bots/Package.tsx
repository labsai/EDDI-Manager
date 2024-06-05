import clsx from 'clsx';
import * as _ from 'lodash';
import * as moment from 'moment';
import * as React from 'react';
import { connect } from 'react-redux';
import ClipLoader from 'react-spinners/ClipLoader';
import { compose, pure, setDisplayName } from 'recompose';
import { PACKAGE_VIEW } from '../../constants/paths';
import { BLUE_COLOR } from '../../../styles/DefaultStylingProperties';
import eddiApiActionDispatchers from '../../actions/EddiApiActionDispatchers';
import { useNavigate } from 'react-router';
import { readOnlySelector } from '../../selectors/AuthenticationSelectors';
import { packageSelector } from '../../selectors/PackageSelectors';
import WhiteButton from '../Assets/Buttons/WhiteButton';
import { IBot, IPackage } from '../utils/AxiosFunctions';
import useStyles from './Package.styles';
import { createSearchParams } from 'react-router-dom';

interface IPrivateProps extends IPublicProps {
  packagePayload: IPackage;
  isLoading: boolean;
  error: Error;
  isLoadingPackageData: boolean;
}

interface IPublicProps {
  packageResource: string;
  bot: IBot;
  readOnly?: boolean;
}

const Package = ({
  packageResource,
  bot,
  readOnly,
  packagePayload,
  isLoading,
  error,
}: IPrivateProps) => {
  const navigate = useNavigate();
  const classes = useStyles();

  React.useEffect(() => {
    if (_.isEmpty(packagePayload)) {
      eddiApiActionDispatchers.fetchPackageAction(packageResource);
    }
  }, []);

  const packageHasNewVersion = packagePayload
    ? packagePayload.version < packagePayload.currentVersion
    : false;
  return (
    <div>
      {!isLoading && (
        <div>
          {!!error && <p>{'Error: Could not load package'}</p>}
          {!error && _.isEmpty(packagePayload) && (
            <ClipLoader color={BLUE_COLOR} />
          )}
          {!error && !_.isEmpty(packagePayload) && (
            <div>
              <button
                onClick={() => {
                  navigate({
                    pathname: `${PACKAGE_VIEW.replace(
                      ':id',
                      packagePayload.id,
                    )}/`,
                    search: createSearchParams({
                      version: packageHasNewVersion
                        ? String(packagePayload.version)
                        : undefined,
                      botId: bot.id,
                    }).toString(),
                  });
                }}
                className={classes.botPackageButton}>
                <div
                  className={clsx(classes.botPackageName, {
                    [classes.hasNewVersion]:
                      packagePayload.version < packagePayload.currentVersion,
                  })}>
                  {packagePayload.name || packagePayload.id}
                </div>
                <div
                  className={clsx(classes.botPackageLastModifiedOn, {
                    [classes.hasNewVersion]:
                      packagePayload.version < packagePayload.currentVersion,
                  })}>
                  {moment(packagePayload.lastModifiedOn).format('DD.MM.YYYY')}
                </div>
              </button>
              {packageHasNewVersion && (
                <WhiteButton
                  text={'Update'}
                  classes={{ button: classes.updatePackages }}
                  onClick={() =>
                    eddiApiActionDispatchers.updateBotAction(
                      bot,
                      packagePayload,
                    )
                  }
                  disabled={readOnly}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ComposedPackage: React.ComponentClass<IPublicProps> = compose<
  IPrivateProps,
  IPublicProps
>(
  pure,
  connect(packageSelector),
  connect(readOnlySelector),
  setDisplayName('Package'),
)(Package);

export default ComposedPackage;
